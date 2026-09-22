/**
 * Estimativa de valor médio de mercado por item, via Claude API com busca na web.
 * Funções puras (prompt e parser) ficam separadas da chamada HTTP para serem testáveis.
 */
import { z } from "zod";
import { LABEL_MOEDA } from "@/lib/labels";
import { IDIOMA_PARA_IA, type Locale } from "@/lib/i18n/config";
import { fmtTexto, type Dicionario } from "@/lib/i18n";
import type { Confianca, FonteEstimativa, Moeda } from "@/lib/types";

export const MODELO_PADRAO = "claude-sonnet-4-6";
export const MAX_BUSCAS = 5;
/** Texto entre buscas e chamadas de ferramenta também consomem max_tokens; 2000 truncava o JSON final. */
export const MAX_TOKENS = 8192;
/** Quantas vezes retomar um turno pausado pelo servidor (stop_reason "pause_turn"). */
const MAX_RETOMADAS = 2;

export interface EntradaEstimativa {
  item: string;
  contexto?: string | null;
  moeda: Moeda;
  nomeProjeto: string;
  descricaoProjeto?: string | null;
  /** Idioma em que premissas/observação devem ser escritas. */
  locale: Locale;
}

export interface ResultadoEstimativa {
  unidade_ref: string;
  valor_min: number;
  valor_medio: number;
  valor_max: number;
  confianca: Confianca;
  premissas: string[];
  fontes: FonteEstimativa[];
  observacao: string | null;
}

export const resultadoSchema = criarResultadoSchema();

export function criarResultadoSchema(msgFaixa = "A faixa deve respeitar mínimo ≤ médio ≤ máximo.",
                                     msgSemValor = "A IA não encontrou um valor médio utilizável.") {
  return z.object({
  unidade_ref: z.string().trim().min(1).max(60).default("unidade"),
  valor_min: z.coerce.number().finite().min(0),
  valor_medio: z.coerce.number().finite().min(0),
  valor_max: z.coerce.number().finite().min(0),
  confianca: z.enum(["baixa", "media", "alta"]).default("media"),
  premissas: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  fontes: z.array(z.object({
    titulo: z.string().trim().min(1).max(200),
    url: z.string().trim().url(),
  })).max(10).default([]),
  observacao: z.string().trim().max(500).nullable().default(null),
  }).superRefine((r, ctx) => {
    if (!(r.valor_min <= r.valor_medio && r.valor_medio <= r.valor_max)) ctx.addIssue({ code: "custom", message: msgFaixa });
    if (r.valor_medio <= 0) ctx.addIssue({ code: "custom", message: msgSemValor });
  });
}

export function montarPrompt(e: EntradaEstimativa): string {
  const simbolo = LABEL_MOEDA[e.moeda];
  return [
    `Você é um analista sênior de custos de capital (Capex) para projetos de logística, mineração e infraestrutura.`,
    `Tarefa: estimar o valor médio de mercado ATUAL, por unidade, do item abaixo, pesquisando na web preços reais (novos e usados quando relevante), cotações de fabricantes, leilões, anúncios e relatórios setoriais.`,
    ``,
    `Item: ${e.item}`,
    e.contexto ? `Contexto informado pelo usuário: ${e.contexto}` : `Contexto informado pelo usuário: (nenhum)`,
    `Projeto: ${e.nomeProjeto}${e.descricaoProjeto ? ` — ${e.descricaoProjeto}` : ""}`,
    `Moeda da resposta: ${e.moeda} (${simbolo}). Converta valores encontrados em outras moedas pela cotação atual e diga isso nas premissas.`,
    ``,
    `Regras:`,
    `- Faça no máximo ${MAX_BUSCAS} buscas. Prefira fontes de 2024 em diante.`,
    `- Defina claramente a unidade de referência (ex.: "unidade", "tonelada de capacidade", "metro") e indique as especificações assumidas (capacidade, porte, novo/usado, região).`,
    `- valor_min e valor_max devem ser a faixa observada; valor_medio é a sua melhor estimativa central.`,
    `- confianca: "alta" (3+ fontes convergentes), "media" (1–2 fontes ou dispersão grande), "baixa" (extrapolação).`,
    `- Se não encontrar nada útil, responda com valor_medio 0 e explique em observacao.`,
    `- Escreva "premissas", "observacao" e os títulos das fontes em ${IDIOMA_PARA_IA[e.locale]}.`,
    ``,
    `Responda SOMENTE com um objeto JSON válido, sem markdown e sem texto antes ou depois, neste formato:`,
    `{"unidade_ref":"unidade","valor_min":0,"valor_medio":0,"valor_max":0,"confianca":"media","premissas":["..."],"fontes":[{"titulo":"...","url":"https://..."}],"observacao":null}`,
  ].join("\n");
}

/** Extrai o JSON do texto (tolera cercas ```json e texto ao redor); JSON malformado vira a mesma mensagem traduzida. */
export function extrairJson(texto: string, msgSemJson = "A resposta da IA não contém JSON."): unknown {
  const semCerca = texto.replace(/```(?:json)?/gi, "").trim();
  const ini = semCerca.indexOf("{");
  const fim = semCerca.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error(msgSemJson);
  try {
    return JSON.parse(semCerca.slice(ini, fim + 1));
  } catch {
    throw new Error(msgSemJson);
  }
}

export function interpretarResposta(texto: string, d?: Dicionario): ResultadoEstimativa {
  const schema = d ? criarResultadoSchema(d.ia.faixa, d.ia.semValor) : resultadoSchema;
  const parsed = schema.safeParse(extrairJson(texto, d?.ia.semJson));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? d?.ia.invalida ?? "Resposta da IA inválida.");
  return parsed.data;
}

/** Bloco de conteúdo da Messages API (texto, server_tool_use, web_search_tool_result…). */
export interface BlocoConteudo { type: string; text?: string }

/**
 * Texto da resposta final: os blocos de texto depois do último resultado de busca, concatenados.
 * Com citações a API divide a resposta em vários blocos "text" contíguos, então o JSON pode vir fatiado.
 * Se essa parte não tiver JSON, cai para todo o texto (o modelo às vezes responde antes da última busca).
 */
export function textoFinal(content: BlocoConteudo[]): string {
  const ultimoNaoTexto = content.map((b) => b.type).lastIndexOf("web_search_tool_result");
  const finais = content.slice(ultimoNaoTexto + 1).filter((b) => b.type === "text" && b.text).map((b) => b.text!);
  const juntos = finais.join("");
  if (juntos.includes("{")) return juntos;
  return content.filter((b) => b.type === "text" && b.text).map((b) => b.text!).join("");
}

interface RespostaMessages { content?: BlocoConteudo[]; stop_reason?: string }

/** Chama a Claude Messages API com a ferramenta de busca na web e devolve o resultado interpretado. */
export async function estimarValorMedio(e: EntradaEstimativa, d: Dicionario): Promise<{ resultado: ResultadoEstimativa; modelo: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(d.ia.semChave);
  const modelo = process.env.ANTHROPIC_MODEL || MODELO_PADRAO;
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_BUSCAS }];
  const messages: { role: "user" | "assistant"; content: string | BlocoConteudo[] }[] = [{ role: "user", content: montarPrompt(e) }];
  const inicio = Date.now();

  let resposta: RespostaMessages;
  for (let tentativa = 0; ; tentativa++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modelo, max_tokens: MAX_TOKENS, messages, tools }),
      signal: AbortSignal.timeout(Math.max(5_000, 55_000 - (Date.now() - inicio))),
    });
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => "");
      throw new Error(fmtTexto(d.ia.apiErro, { status: resp.status, corpo: corpo.slice(0, 300) }));
    }
    resposta = (await resp.json()) as RespostaMessages;
    // "pause_turn": o servidor interrompeu o laço de buscas; reenviar o histórico faz ele retomar de onde parou.
    if (resposta.stop_reason !== "pause_turn" || tentativa >= MAX_RETOMADAS) break;
    messages.push({ role: "assistant", content: resposta.content ?? [] });
  }

  if (resposta.stop_reason === "max_tokens") throw new Error(d.ia.truncada);
  const texto = textoFinal(resposta.content ?? []);
  if (!texto.trim()) throw new Error(d.ia.semTexto);
  return { resultado: interpretarResposta(texto, d), modelo };
}
