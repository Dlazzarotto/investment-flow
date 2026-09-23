/**
 * Motor de custeio: da estrutura de custo para o preço de venda.
 * Conta pura, sem I/O — testada em tests/custeio.test.ts.
 *
 * Cada item tem um DRIVER que diz como o valor vira custo por unidade de produto
 * (ver supabase/migrations/0008_custeio_estimativas.sql). Depois de somar tudo em
 * R$/t, o preço sai de uma equação, não de uma soma: impostos e comissão são
 * percentuais SOBRE A RECEITA, que depende do preço, que depende do custo, que
 * inclui os impostos. Resolvendo:
 *
 *   P = C + r·P + m·P   →   P = C / (1 − r − m)
 *
 * com C = custo por tonelada que não depende do preço, r = impostos + comissão
 * e m = margem alvo (ambos em fração). Somar "custo + impostos + margem" direto,
 * como se fosse uma pilha, subestima o preço — é o erro clássico desse cálculo.
 */
import type { DriverCusto, EstimativaCusto, EstimativaItem, GrupoCusto } from "./types";

/** Drivers cujo valor é percentual, não moeda. */
export const DRIVERS_PERCENTUAIS: readonly DriverCusto[] = ["pct_custo", "pct_receita"];

export function ehPercentual(driver: DriverCusto): boolean {
  return DRIVERS_PERCENTUAIS.includes(driver);
}

/** Parâmetros do cabeçalho que o cálculo consome. */
export type ParametrosEstimativa = Pick<
  EstimativaCusto, "volume_total" | "producao_diaria" | "dias_mes" | "margem_alvo_pct"
>;

export interface ItemCalculado {
  id: string;
  etapaId: string | null;
  grupo: GrupoCusto;
  nome: string;
  driver: DriverCusto;
  origem: string;
  /** Custo por unidade de produto. Null quando o driver não pode ser convertido. */
  porUnidade: number | null;
  /** Motivo de não ter dado para converter (ex.: produção diária zerada). */
  impedimento: "sem_producao_diaria" | "sem_capacidade" | null;
}

export interface ResultadoCusteio {
  itens: ItemCalculado[];
  /** Custo por unidade dos itens em moeda (tudo que não é percentual). */
  custoDireto: number;
  /** Acréscimo dos itens pct_custo, aplicado sobre o custo direto. */
  custoIndireto: number;
  /** custoDireto + custoIndireto: o C da equação. */
  custoUnitario: number;
  /** Soma dos percentuais sobre a receita (impostos, royalties, comissão), em fração. */
  taxaSobreReceita: number;
  /** Margem alvo em fração. */
  margem: number;
  /** Preço por unidade que faz a margem fechar; null quando impossível. */
  preco: number | null;
  /** Por que não há preço: impostos + margem consomem 100 % ou mais da receita. */
  impossivel: boolean;
  /** Valor por unidade dos percentuais sobre a receita, já com o preço encontrado. */
  impostosPorUnidade: number;
  /** Lucro por unidade. */
  margemPorUnidade: number;
  /** preco × volume_total. */
  receitaTotal: number;
  /** custoUnitario × volume_total. */
  custoTotal: number;
  /** Itens que não puderam ser convertidos e ficaram de fora da soma. */
  itensIgnorados: ItemCalculado[];
  /** Custo por unidade somado por grupo, para a quebra na tela. */
  porGrupo: { grupo: GrupoCusto; valor: number }[];
  /** Custo por unidade somado por etapa da cadeia; etapaId null = fora de etapa. */
  porEtapa: { etapaId: string | null; valor: number }[];
}

/**
 * Converte um item para custo por unidade de produto.
 * Devolve null quando falta o divisor — produção diária zerada com um custo
 * por dia, por exemplo. Nesse caso o item não entra na soma e a tela avisa,
 * em vez de silenciosamente virar zero.
 */
export function converterItem(item: Pick<EstimativaItem, "driver" | "valor" | "quantidade" | "capacidade">,
                              p: ParametrosEstimativa): { porUnidade: number | null; impedimento: ItemCalculado["impedimento"] } {
  const valor = Number(item.valor) * Number(item.quantidade);
  const producaoDiaria = Number(p.producao_diaria);
  const volume = Number(p.volume_total);

  switch (item.driver) {
    case "por_unidade":
      return { porUnidade: valor, impedimento: null };
    case "por_dia":
      return producaoDiaria > 0
        ? { porUnidade: valor / producaoDiaria, impedimento: null }
        : { porUnidade: null, impedimento: "sem_producao_diaria" };
    case "por_mes": {
      const porDia = Number(p.dias_mes) > 0 ? valor / Number(p.dias_mes) : 0;
      return producaoDiaria > 0
        ? { porUnidade: porDia / producaoDiaria, impedimento: null }
        : { porUnidade: null, impedimento: "sem_producao_diaria" };
    }
    case "por_viagem": {
      // R$ por viagem ÷ toneladas que cabem nela — caminhão, barcaça ou navio.
      const capacidade = Number(item.capacidade ?? 0);
      return capacidade > 0
        ? { porUnidade: valor / capacidade, impedimento: null }
        : { porUnidade: null, impedimento: "sem_capacidade" };
    }
    case "por_lote":
      return volume > 0 ? { porUnidade: valor / volume, impedimento: null } : { porUnidade: null, impedimento: null };
    // Percentuais não viram R$/t sozinhos: dependem do custo ou do preço.
    case "pct_custo":
    case "pct_receita":
      return { porUnidade: null, impedimento: null };
  }
}

export function calcularCusteio(itens: EstimativaItem[], p: ParametrosEstimativa): ResultadoCusteio {
  const calculados: ItemCalculado[] = itens.map((i) => {
    const { porUnidade, impedimento } = converterItem(i, p);
    return { id: i.id, etapaId: i.etapa_id, grupo: i.grupo, nome: i.nome, driver: i.driver,
             origem: i.origem, porUnidade, impedimento };
  });

  const absolutos = calculados.filter((c) => !ehPercentual(c.driver));
  const custoDireto = arred4(soma(absolutos.map((c) => c.porUnidade ?? 0)));

  // pct_custo incide sobre o custo direto inteiro — assim a ordem dos itens não muda o resultado.
  const pctCusto = soma(itens.filter((i) => i.driver === "pct_custo").map((i) => Number(i.valor) * Number(i.quantidade)));
  const custoIndireto = arred4(custoDireto * pctCusto / 100);
  const custoUnitario = arred4(custoDireto + custoIndireto);

  const taxaSobreReceita = soma(itens.filter((i) => i.driver === "pct_receita")
    .map((i) => Number(i.valor) * Number(i.quantidade))) / 100;
  const margem = Number(p.margem_alvo_pct) / 100;

  const denominador = 1 - taxaSobreReceita - margem;
  const impossivel = !(denominador > 0);
  const preco = impossivel ? null : arred(custoUnitario / denominador);

  const impostosPorUnidade = preco === null ? 0 : arred(preco * taxaSobreReceita);
  const margemPorUnidade = preco === null ? 0 : arred(preco * margem);
  const volume = Number(p.volume_total);

  const grupos = new Map<GrupoCusto, number>();
  const etapas = new Map<string | null, number>();
  for (const c of absolutos) {
    if (c.porUnidade === null) continue;
    grupos.set(c.grupo, (grupos.get(c.grupo) ?? 0) + c.porUnidade);
    etapas.set(c.etapaId, (etapas.get(c.etapaId) ?? 0) + c.porUnidade);
  }

  return {
    itens: calculados,
    custoDireto,
    custoIndireto,
    custoUnitario,
    taxaSobreReceita,
    margem,
    preco,
    impossivel,
    impostosPorUnidade,
    margemPorUnidade,
    receitaTotal: preco === null ? 0 : arred(preco * volume),
    custoTotal: arred(custoUnitario * volume),
    itensIgnorados: calculados.filter((c) => c.impedimento !== null),
    porGrupo: [...grupos.entries()]
      .map(([grupo, valor]) => ({ grupo, valor: arred4(valor) }))
      .sort((a, b) => b.valor - a.valor),
    // Ordem da cadeia é responsabilidade da tela (tem os nomes); aqui só a soma.
    porEtapa: [...etapas.entries()].map(([etapaId, valor]) => ({ etapaId, valor: arred4(valor) })),
  };
}

/**
 * Margem que sobra ao vender por um preço dado — para comparar o preço calculado
 * com o que o mercado está pagando.
 */
export function margemNoPreco(resultado: ResultadoCusteio, precoMercado: number): number | null {
  if (!(precoMercado > 0)) return null;
  const receitaLiquida = precoMercado * (1 - resultado.taxaSobreReceita);
  return (receitaLiquida - resultado.custoUnitario) / precoMercado;
}

function soma(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function arred(x: number): number {
  return Math.round(x * 100) / 100;
}
/** Custo por tonelada pede mais casas: centavos por tonelada viram milhares no lote. */
function arred4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
