import { z } from "zod";
import { ehDataISO } from "@/lib/validacao";

/**
 * Pesquisa de mercado (0031) — a parte PURA: montar a pergunta para o agente,
 * ler o JSON que ele devolve e preparar o texto para a tela. Sem rede aqui: o
 * que fala com o agente está em lib/ia/pesquisador.ts.
 */

export const TIPOS_COTACAO = ["spot", "indice", "futuro", "oferta"] as const;
export type TipoCotacao = (typeof TIPOS_COTACAO)[number];
export const IDIOMAS_PESQUISA = ["pt", "en", "es", "zh"] as const;
export type IdiomaPesquisa = (typeof IDIOMAS_PESQUISA)[number];

/** O que o agente precisa saber para pesquisar — o nome sozinho ("minério") não basta. */
export interface PedidoPesquisa {
  commodity: string;
  grade?: string | null;
  /** Parâmetros do grade (ou os padrão da commodity), já em texto: "Fe ≥ 62 %", "Umidade ≤ 9 %". */
  especificacao?: string[];
  base?: string | null;
  referencia?: string | null;
  idioma: IdiomaPesquisa;
  detalhado?: boolean;
}

export function montarPergunta(p: PedidoPesquisa): string {
  const linhas = [
    `idioma: ${p.idioma}`,
    `Commodity: ${p.commodity}${p.grade ? ` — ${p.grade}` : ""}`,
    p.especificacao?.length ? `Especificação: ${p.especificacao.join("; ")}` : null,
    p.base ? `Base de entrega pedida: ${p.base}` : "Base de entrega: a referência internacional mais usada para este produto",
    p.referencia ? `Referência de preço que a empresa costuma usar: ${p.referencia}` : null,
    p.detalhado ? "detalhado" : null,
    "Traga o preço de mercado atual, com fonte, data, base e unidade, e termine com o bloco JSON.",
  ];
  return linhas.filter(Boolean).join("\n").slice(0, 2000);
}

/** Uma cotação como o agente a devolve no JSON (tolerante a campos faltando). */
const numeroOuNulo = z.union([z.number(), z.string(), z.null()]).optional().transform((x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
});
const textoOuNulo = (max: number) => z.unknown().optional().transform((x) =>
  typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);

const cotacaoSchema = z.object({
  commodity: textoOuNulo(160),
  especificacao: textoOuNulo(300),
  base: textoOuNulo(160),
  unidade: textoOuNulo(40),
  preco: numeroOuNulo,
  moeda: z.unknown().optional().transform((x) => (typeof x === "string" && /^[A-Za-z]{3}$/.test(x.trim()) ? x.trim().toUpperCase() : null)),
  data: z.unknown().optional().transform((x) => (typeof x === "string" && ehDataISO(x.trim()) ? x.trim() : null)),
  tipo: z.unknown().optional().transform((x) =>
    (typeof x === "string" && (TIPOS_COTACAO as readonly string[]).includes(x.trim()) ? (x.trim() as TipoCotacao) : null)),
  fonte: textoOuNulo(300),
  url: z.unknown().optional().transform((x) => (typeof x === "string" && /^https?:\/\//.test(x.trim()) ? x.trim().slice(0, 1000) : null)),
  aproximacao: z.unknown().optional().transform((x) => (typeof x === "boolean" ? x : null)),
});
export type Cotacao = z.infer<typeof cotacaoSchema>;

/**
 * Lê a referência principal do ÚLTIMO bloco ```json da resposta. Se for uma lista
 * (várias bases), fica a primeira que tem preço; se nenhuma tiver, a primeira.
 * Null quando não há JSON legível — a resposta em texto continua valendo.
 */
export function extrairCotacao(texto: string): Cotacao | null {
  const blocos = [...texto.matchAll(/```json\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidato = blocos.at(-1) ?? texto.match(/(\{[^{}]*"preco"[^{}]*\})/)?.[1];
  if (!candidato) return null;
  let bruto: unknown;
  try { bruto = JSON.parse(candidato.trim()); } catch { return null; }
  const lista = (Array.isArray(bruto) ? bruto : [bruto])
    .map((x) => cotacaoSchema.safeParse(x)).filter((r) => r.success).map((r) => r.data as Cotacao);
  return lista.find((c) => c.preco !== null) ?? lista[0] ?? null;
}

/** A resposta para a tela: sem o bloco JSON (é para o sistema), com as tabelas markdown separadas. */
export type BlocoResposta = { tipo: "texto"; texto: string } | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

export function blocosResposta(texto: string): BlocoResposta[] {
  const limpo = texto.replace(/```json[\s\S]*?```/gi, "").trim();
  const saida: BlocoResposta[] = [];
  let paragrafo: string[] = [];
  let tabela: string[][] = [];
  const celulas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const fecharParagrafo = () => { if (paragrafo.join("").trim()) saida.push({ tipo: "texto", texto: paragrafo.join("\n").trim() }); paragrafo = []; };
  const fecharTabela = () => {
    const semSeparador = tabela.filter((l) => !l.every((c) => /^:?-{2,}:?$/.test(c)));
    if (semSeparador.length) saida.push({ tipo: "tabela", cabecalho: semSeparador[0], linhas: semSeparador.slice(1) });
    tabela = [];
  };
  for (const linha of limpo.split("\n")) {
    if (/^\s*\|.*\|\s*$/.test(linha)) { fecharParagrafo(); tabela.push(celulas(linha)); }
    else { if (tabela.length) fecharTabela(); paragrafo.push(linha); }
  }
  if (tabela.length) fecharTabela();
  fecharParagrafo();
  return saida;
}

/** Variação % entre a última cotação e a anterior — só quando são comparáveis (mesma moeda e unidade). */
export function variacao(atual: { preco: number | null; moeda: string | null; unidade: string | null },
                         anterior?: { preco: number | null; moeda: string | null; unidade: string | null } | null): number | null {
  if (!anterior || atual.preco === null || anterior.preco === null || anterior.preco === 0) return null;
  if (atual.moeda !== anterior.moeda || (atual.unidade ?? "").toLowerCase() !== (anterior.unidade ?? "").toLowerCase()) return null;
  return Math.round(((atual.preco - anterior.preco) / anterior.preco) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Painel de bolsas: o preço da commodity em Xangai, Londres e Chicago
// ---------------------------------------------------------------------------

export const PRACAS = ["xangai", "londres", "chicago"] as const;
export type Praca = (typeof PRACAS)[number];

/**
 * A pergunta do painel. As três praças são as referências mundiais, mas nem todo
 * produto é negociado nas três: minério de ferro na China é Dalian (DCE), açúcar é
 * Zhengzhou (ZCE) e Nova York (ICE US). Por isso a pergunta manda usar a bolsa
 * certa DAQUELA praça e dizer qual foi — e marcar "não negociado" em vez de
 * emprestar número de outro lugar.
 */
export function montarPerguntaBolsas(p: Omit<PedidoPesquisa, "base" | "detalhado" | "referencia">): string {
  return [
    `idioma: ${p.idioma}`,
    `Commodity: ${p.commodity}${p.grade ? ` — ${p.grade}` : ""}`,
    p.especificacao?.length ? `Especificação: ${p.especificacao.join("; ")}` : null,
    "PAINEL DE BOLSAS: traga o último preço de ajuste (settlement) desta commodity em três praças, no contrato mais líquido (1º ou 2º vencimento):",
    "- xangai: mercado chinês — SHFE/INE; se o produto for negociado em outra bolsa chinesa (DCE, ZCE, GFEX), use essa e diga qual.",
    "- londres: LME ou ICE Futures Europe.",
    "- chicago: referência americana — CME Group (CBOT, CME, NYMEX, COMEX); se a referência dos EUA for a ICE US (Nova York), use-a e diga qual.",
    "Se o produto não tiver contrato negociado numa praça, marque negociado: false e preco: null — nunca use número de outra praça ou de outro produto.",
    "No JSON, \"moeda\" é o código ISO (USD, CNY, GBP) e \"unidade\" é só a unidade de quantidade (t, dmt, lb, bu, bbl, oz, MMBtu). Bolsa que cota em centavos (¢/lb, ¢/bu): converta para a moeda cheia (17,85 ¢/lb → 0.1785 USD por lb).",
    "Resposta curta: uma linha por praça. Termine com o bloco JSON em LISTA, exatamente três objetos, neste formato:",
    '[{"mercado": "xangai|londres|chicago", "negociado": true, "bolsa": "", "contrato": "", "preco": 0, "moeda": "", "unidade": "", "data": "AAAA-MM-DD", "url": "", "aproximacao": false}]',
  ].filter(Boolean).join("\n").slice(0, 2000);
}

const cotacaoBolsaSchema = z.object({
  mercado: z.string().transform((x) => x.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")).pipe(z.enum(PRACAS)),
  negociado: z.unknown().optional().transform((x) => (typeof x === "boolean" ? x : null)),
  bolsa: textoOuNulo(80),
  contrato: textoOuNulo(160),
  preco: numeroOuNulo,
  moeda: cotacaoSchema.shape.moeda,
  unidade: textoOuNulo(40),
  data: cotacaoSchema.shape.data,
  url: cotacaoSchema.shape.url,
  aproximacao: cotacaoSchema.shape.aproximacao,
}).transform((c) => ({ ...c, negociado: c.negociado ?? c.preco !== null }));
/** negociado: true/false como o agente disse; null = a praça não veio na resposta ("não informado"). */
export type CotacaoBolsa = Omit<z.infer<typeof cotacaoBolsaSchema>, "negociado"> & { negociado: boolean | null };

/**
 * As três cotações do último bloco JSON, SEMPRE na ordem Xangai, Londres, Chicago.
 * Praça que o agente não devolveu (ou devolveu ilegível) vem vazia — sem preço, com
 * negociado null ("não informado"), que a tela distingue de "não negociado".
 */
export function extrairCotacoesBolsas(texto: string): CotacaoBolsa[] {
  const bloco = [...texto.matchAll(/```json\s*([\s\S]*?)```/gi)].map((m) => m[1]).at(-1);
  let bruto: unknown = [];
  if (bloco) { try { bruto = JSON.parse(bloco.trim()); } catch { bruto = []; } }
  const lidas = (Array.isArray(bruto) ? bruto : [bruto]).map((x) => cotacaoBolsaSchema.safeParse(x))
    .filter((r) => r.success).map((r) => r.data as CotacaoBolsa);
  return PRACAS.map((mercado) => lidas.find((c) => c.mercado === mercado) ?? {
    mercado, negociado: null, bolsa: null, contrato: null, preco: null, moeda: null, unidade: null,
    data: null, url: null, aproximacao: null,
  });
}
