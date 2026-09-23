/**
 * Sugestão de custo para uma linha do custeio: quanto se paga por um cargo, num
 * país, ou por um serviço, num trecho da cadeia.
 *
 * A resposta vem na MESMA base do driver escolhido pelo usuário (por mês, por
 * viagem, por tonelada…). É o que separa isto de uma pesquisa de preço solta: o
 * número volta pronto para entrar no campo, sem conversão na cabeça de ninguém.
 *
 * Nada é gravado: a sugestão preenche o formulário e só vira item quando a pessoa
 * salva — aí fica marcada com origem 'ia' e a fonte, até alguém confirmar.
 */
import { LABEL_MOEDA } from "@/lib/labels";
import { IDIOMA_PARA_IA, type Locale } from "@/lib/i18n/config";
import type { Dicionario } from "@/lib/i18n";
import type { DriverCusto, Moeda } from "@/lib/types";
import { MAX_BUSCAS, chamarClaude, interpretarResposta, type ResultadoEstimativa } from "./estimativa";

export type TipoCusto = "cargo" | "servico";

export interface EntradaCusto {
  tipo: TipoCusto;
  /** Nome do cargo ("operador de escavadeira") ou do serviço ("frete rodoviário"). */
  descricao: string;
  /** País da etapa — define a legislação trabalhista e o mercado consultados. */
  pais?: string | null;
  /** Etapa da cadeia a que o custo pertence, para situar a busca. */
  etapa?: string | null;
  commodity: string;
  moeda: Moeda;
  driver: DriverCusto;
  /** Unidade do produto (Toneladas, m³…): a base dos drivers por unidade e por lote. */
  unidadeProduto: string;
  locale: Locale;
}

/** Em que base o número precisa voltar, para cair direto no campo "valor". */
const BASE_DO_DRIVER: Record<DriverCusto, string> = {
  por_unidade: "o custo POR UMA UNIDADE DE PRODUTO ({unidade})",
  por_dia: "o custo POR DIA de operação",
  por_mes: "o custo POR MÊS",
  por_viagem: "o custo POR VIAGEM (um veículo/embarcação carregado)",
  por_lote: "o custo do LOTE INTEIRO, uma vez só",
  pct_custo: "o percentual (0 a 100) aplicado sobre o custo direto",
  pct_receita: "o percentual (0 a 100) aplicado sobre a receita da venda",
};

export function montarPromptCusto(e: EntradaCusto): string {
  const simbolo = LABEL_MOEDA[e.moeda];
  const base = BASE_DO_DRIVER[e.driver].replace("{unidade}", e.unidadeProduto);
  const ehCargo = e.tipo === "cargo";
  const local = e.pais?.trim() || null;

  return [
    ehCargo
      ? `Você é um especialista em remuneração e legislação trabalhista, com foco em mineração, agronegócio e logística.`
      : `Você é um analista sênior de custos operacionais e logísticos de commodities.`,
    ehCargo
      ? `Tarefa: pesquisar na web quanto CUSTA PARA O EMPREGADOR manter o cargo abaixo, no país indicado, hoje.`
      : `Tarefa: pesquisar na web o preço de mercado atual do serviço abaixo, no trecho indicado.`,
    ``,
    ehCargo ? `Cargo: ${e.descricao}` : `Serviço: ${e.descricao}`,
    `País / região: ${local ?? "(não informado — use a média do mercado internacional e diga isso nas premissas)"}`,
    e.etapa ? `Etapa da cadeia: ${e.etapa}` : `Etapa da cadeia: (não informada)`,
    `Commodity do projeto: ${e.commodity}`,
    `Moeda da resposta: ${e.moeda} (${simbolo}). Converta pela cotação atual o que encontrar em outra moeda e registre isso nas premissas.`,
    ``,
    `MUITO IMPORTANTE — base da resposta: valor_min, valor_medio e valor_max devem ser ${base}.`,
    `Se a fonte trouxer outra base, converta e explique a conversão nas premissas.`,
    ``,
    `Regras:`,
    `- Faça no máximo ${MAX_BUSCAS} buscas. Prefira fontes de 2024 em diante: convenções coletivas, tabelas oficiais, sindicatos, operadores logísticos e relatórios setoriais.`,
    ehCargo
      ? `- Inclua o CUSTO TOTAL do empregador: salário base mais encargos, provisões e benefícios obrigatórios daquele país. Diga nas premissas o que entrou e qual o salário base.`
      : `- Considere o serviço completo naquele trecho, incluindo taxas e sobretaxas usuais. Diga nas premissas o que está incluído e o que ficou de fora.`,
    ehCargo
      ? `- Não some adicional noturno nem horas extras: o sistema aplica esses adicionais depois. Informe na observacao qual é o percentual legal do adicional noturno nesse país.`
      : `- Indique na observacao o que mais costuma alterar esse preço (distância, sazonalidade, volume mínimo).`,
    `- unidade_ref deve descrever a base em uma linha curta (ex.: "${e.moeda} por mês, por pessoa, com encargos").`,
    `- valor_min e valor_max são a faixa observada; valor_medio é a sua melhor estimativa central.`,
    `- confianca: "alta" (3+ fontes convergentes), "media" (1–2 fontes ou dispersão grande), "baixa" (extrapolação).`,
    `- Se não encontrar nada útil, responda com valor_medio 0 e explique em observacao.`,
    `- Escreva "premissas", "observacao" e os títulos das fontes em ${IDIOMA_PARA_IA[e.locale]}.`,
    ``,
    `Responda SOMENTE com um objeto JSON válido, sem markdown e sem texto antes ou depois, neste formato:`,
    `{"unidade_ref":"...","valor_min":0,"valor_medio":0,"valor_max":0,"confianca":"media","premissas":["..."],"fontes":[{"titulo":"...","url":"https://..."}],"observacao":null}`,
  ].join("\n");
}

export async function sugerirCusto(e: EntradaCusto, d: Dicionario): Promise<{ resultado: ResultadoEstimativa; modelo: string }> {
  const { texto, modelo } = await chamarClaude(montarPromptCusto(e), d);
  return { resultado: interpretarResposta(texto, d), modelo };
}
