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
    "No JSON, \"preco\" é o número COMO A BOLSA COTA, \"moeda\" é o código ISO (USD, CNY, GBP) e \"unidade\" é só a unidade de quantidade (t, dmt, lb, bu, bbl, oz, MMBtu). Bolsa que cota em centavos (¢/lb, ¢/bu): converta para a moeda cheia (17,85 ¢/lb → 0.1785 USD por lb).",
    "O sistema mostra tudo por TONELADA MÉTRICA e converte sozinho as unidades de massa (lb, kg, oz, short ton). Para unidade de volume ou energia (bu, bbl, gal, MMBtu), informe em \"fator_t\" quantas dessas unidades há numa tonelada DESTA commodity pelo padrão do mercado (ex.: soja 36.7437 bu/t; milho 39.3679 bu/t; petróleo Brent ≈ 7.5 bbl/t). Unidade de massa: \"fator_t\": null.",
    "O sistema mostra tudo em DÓLAR: se a moeda não for USD, informe em \"cambio_usd\" quantos USD vale 1 unidade da moeda NA DATA da cotação (ex.: CNY → 0.1405), de fonte pública; USD: \"cambio_usd\": 1. Em \"com_iva\" diga se o preço publicado inclui imposto local (os ajustes de SHFE/DCE/ZCE incluem 13 % de IVA chinês): true/false.",
    "Resposta curta: uma linha por praça. Termine com o bloco JSON em LISTA, exatamente três objetos, neste formato:",
    '[{"mercado": "xangai|londres|chicago", "negociado": true, "bolsa": "", "contrato": "", "preco": 0, "moeda": "", "unidade": "", "data": "AAAA-MM-DD", "url": "", "aproximacao": false, "fator_t": null, "cambio_usd": 1, "com_iva": false}]',
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
  fator_t: numeroOuNulo.transform((x) => (x !== null && x > 0 ? x : null)),
  cambio_usd: numeroOuNulo.transform((x) => (x !== null && x > 0 ? x : null)),
  com_iva: z.unknown().optional().transform((x) => (typeof x === "boolean" ? x : null)),
}).transform((c) => ({ ...c, negociado: c.negociado ?? c.preco !== null }));
/** negociado: true/false como o agente disse; null = a praça não veio na resposta ("não informado"). */
export type CotacaoBolsa = Omit<z.infer<typeof cotacaoBolsaSchema>, "negociado" | "fator_t" | "cambio_usd" | "com_iva"> & {
  negociado: boolean | null;
  /** Unidades da cotação por tonelada, informado pelo agente para volume/energia. Pesquisa antiga não tem. */
  fator_t?: number | null;
  /** USD por 1 unidade da moeda, na data da cotação (agente). */
  cambio_usd?: number | null;
  /** O preço publicado inclui imposto local (ex.: 13 % de IVA nas bolsas chinesas). */
  com_iva?: boolean | null;
};

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
    data: null, url: null, aproximacao: null, fator_t: null, cambio_usd: null, com_iva: null,
  });
}

/** Unidades de massa: quantas há numa tonelada métrica. Conversão física, igual para qualquer commodity. */
const POR_TONELADA: Record<string, number> = {
  t: 1, mt: 1, tonne: 1, tonnes: 1, ton: 1, tons: 1, tonelada: 1, toneladas: 1, dmt: 1, wmt: 1, dmtu: 1, "吨": 1,
  kg: 1000, g: 1_000_000, lb: 2204.62262, lbs: 2204.62262, libra: 2204.62262, libras: 2204.62262,
  oz: 32150.7466, ozt: 32150.7466, "troy oz": 32150.7466, "onça troy": 32150.7466, "onças troy": 32150.7466,
  st: 1.10231131, "short ton": 1.10231131, lt: 0.984206528, "long ton": 0.984206528,
};

/**
 * Preço por tonelada métrica, na moeda da cotação. Massa converte sozinha; volume e
 * energia (bushel, barril, MMBtu) só com o fator da commodity que o agente informou
 * — sem ele, null ("sem conversão"), nunca um fator chutado. Aceita a unidade com
 * centavos ("¢/lb", "USc/bu"): divide por 100. dmt fica como tonelada (base seca),
 * e a tela mostra a cotação original ao lado para não esconder isso.
 */
export function precoPorTonelada(c: { preco: number | null; unidade: string | null; fator_t?: number | null }): number | null {
  if (c.preco === null || !c.unidade) return null;
  let u = c.unidade.trim().toLowerCase().replace(/^por\s+/, "");
  // Centavos: "¢/lb", "USc/bu", "cents/lb", "c/bu" (só antes da barra, para não pegar "ct" de outra coisa).
  const fatorMoeda = /^(¢|us¢|usc|c|cents?)\s*\//.test(u) || u.startsWith("¢") ? 0.01 : 1;
  // "USD/t", "¢/lb", "US$/dmt" → só o que vem depois da barra.
  if (u.includes("/")) u = u.slice(u.lastIndexOf("/") + 1).trim();
  const massa = POR_TONELADA[u];
  const fator = massa ?? c.fator_t ?? null;
  if (!fator) return null;
  return Math.round(c.preco * fatorMoeda * fator * 100) / 100;
}

/**
 * Preço em USD por tonelada métrica — o que o painel mostra. USD dispensa câmbio;
 * outra moeda só com o câmbio que o agente trouxe da data da cotação. Sem câmbio
 * ou sem fator de tonelada, null: a tela mostra a cotação original e avisa.
 */
export function precoUsdPorTonelada(c: { preco: number | null; moeda: string | null; unidade: string | null;
  fator_t?: number | null; cambio_usd?: number | null }): number | null {
  const porT = precoPorTonelada(c);
  if (porT === null) return null;
  const moeda = (c.moeda ?? "").toUpperCase();
  const cambio = moeda === "USD" ? 1 : c.cambio_usd ?? null;
  if (!cambio) return null;
  return Math.round(porT * cambio * 100) / 100;
}
