/**
 * Regras de cálculo puras (sem I/O) — testadas em tests/calculos.test.ts.
 * A agregação mensal contínua é feita no banco por public.fluxo_mensal(); aqui
 * ficam KPIs, break-even e rateio por participação.
 */
import type { Despesa, FluxoMensal, Investimento, Participante, Projeto, TipoParticipante, Venda } from "./types";

export interface Kpis {
  investimentoTotal: number;
  receitaTotal: number;
  /** Custo direto das vendas (mercadoria, frete, impostos, comissão). */
  custoVendasTotal: number;
  /** Despesas de custeio do projeto. */
  despesasTotal: number;
  /** Tudo que saiu: investimento + custo de vendas + despesas. */
  saidaTotal: number;
  /** Receita − custo direto das vendas: o que a operação deixa antes do custeio. */
  margemBruta: number;
  /** margemBruta ÷ receita; null sem receita. */
  margemPct: number | null;
  /** Receita − saída total. */
  saldo: number;
  /** saldo ÷ investimento — retorno sobre o capital aportado; null sem investimento. */
  roi: number | null;
}

export function calcularKpis(investimentos: Pick<Investimento, "valor_total">[],
                             vendas: Pick<Venda, "receita_total" | "custo_total">[],
                             despesas: Pick<Despesa, "valor">[] = []): Kpis {
  const investimentoTotal = soma(investimentos.map((i) => Number(i.valor_total)));
  const receitaTotal = soma(vendas.map((v) => Number(v.receita_total)));
  const custoVendasTotal = soma(vendas.map((v) => Number(v.custo_total ?? 0)));
  const despesasTotal = soma(despesas.map((d) => Number(d.valor)));
  const saidaTotal = investimentoTotal + custoVendasTotal + despesasTotal;
  const margemBruta = receitaTotal - custoVendasTotal;
  const saldo = arred(receitaTotal - saidaTotal);
  return {
    investimentoTotal: arred(investimentoTotal),
    receitaTotal: arred(receitaTotal),
    custoVendasTotal: arred(custoVendasTotal),
    despesasTotal: arred(despesasTotal),
    saidaTotal: arred(saidaTotal),
    margemBruta: arred(margemBruta),
    margemPct: receitaTotal > 0 ? margemBruta / receitaTotal : null,
    saldo,
    roi: investimentoTotal > 0 ? saldo / investimentoTotal : null,
  };
}

/** Quebra do custo de uma venda nos quatro componentes que o banco soma em custo_total. */
export interface CustoVenda {
  mercadoria: number;
  frete: number;
  impostos: number;
  comissao: number;
  total: number;
  /** Receita − custo total da venda. */
  margem: number;
  /** margem ÷ receita; null sem receita. */
  margemPct: number | null;
}

export function detalharCustoVenda(v: Pick<Venda, "volume" | "preco_unitario" | "custo_unitario" | "frete_unitario" | "impostos_pct" | "comissao_pct">): CustoVenda {
  const volume = Number(v.volume);
  const receita = volume * Number(v.preco_unitario);
  const mercadoria = volume * Number(v.custo_unitario ?? 0);
  const frete = volume * Number(v.frete_unitario ?? 0);
  const impostos = receita * Number(v.impostos_pct ?? 0) / 100;
  const comissao = receita * Number(v.comissao_pct ?? 0) / 100;
  const total = mercadoria + frete + impostos + comissao;
  const margem = receita - total;
  return {
    mercadoria: arred(mercadoria), frete: arred(frete), impostos: arred(impostos), comissao: arred(comissao),
    total: arred(total), margem: arred(margem),
    margemPct: receita > 0 ? margem / receita : null,
  };
}

/** Despesas somadas por categoria, para o gráfico e a exportação. */
export function despesasPorCategoria(despesas: Pick<Despesa, "categoria" | "valor">[]) {
  const mapa = new Map<string, number>();
  for (const d of despesas) mapa.set(d.categoria, (mapa.get(d.categoria) ?? 0) + Number(d.valor));
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor: arred(valor) }))
    .sort((a, b) => b.valor - a.valor);
}

/** Primeiro mês em que a receita acumulada iguala ou supera tudo que saiu (>0). */
export function encontrarBreakeven(fluxo: FluxoMensal[]): string | null {
  const hit = fluxo.find((f) => Number(f.saida_acumulada) > 0 && Number(f.rec_acumulada) >= Number(f.saida_acumulada));
  return hit ? hit.mes : null;
}

/** Investimento por categoria, para o gráfico de alocação. */
export function alocacaoPorCategoria(investimentos: Pick<Investimento, "categoria" | "valor_total">[]) {
  const mapa = new Map<string, number>();
  for (const i of investimentos) {
    mapa.set(i.categoria, (mapa.get(i.categoria) ?? 0) + Number(i.valor_total));
  }
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor: arred(valor) }))
    .sort((a, b) => b.valor - a.valor);
}

/** Papel de uma linha do rateio: o dono do projeto, um participante cadastrado ou o percentual ainda não alocado. */
export type TipoRateio = TipoParticipante | "dono" | "restante";

export interface Rateio {
  /** Nome do participante; vazio nas linhas "dono" e "restante" (a tela e a exportação usam o dicionário). */
  nome: string;
  tipo: TipoRateio;
  percentual: number;
  saldoAtribuivel: number;
  investimentoAtribuivel: number;
  receitaAtribuivel: number;
}

/**
 * Rateia investimento, receita e saldo pela participação de cada parte.
 * A primeira linha é sempre a participação do dono do projeto (tipo "dono").
 * A última linha (tipo "restante") só aparece se a soma for < 100 %.
 */
export function ratearParticipacoes(projeto: Pick<Projeto, "participacao_pct">,
                                    participantes: Pick<Participante, "nome" | "tipo" | "percentual">[],
                                    kpis: Kpis): Rateio[] {
  const linha = (nome: string, tipo: TipoRateio, pct: number): Rateio => ({
    nome, tipo, percentual: pct,
    saldoAtribuivel: arred(kpis.saldo * pct / 100),
    investimentoAtribuivel: arred(kpis.investimentoTotal * pct / 100),
    receitaAtribuivel: arred(kpis.receitaTotal * pct / 100),
  });
  const linhas = [linha("", "dono", Number(projeto.participacao_pct))];
  for (const p of participantes) linhas.push(linha(p.nome, p.tipo, Number(p.percentual)));
  const alocado = soma(linhas.map((l) => l.percentual));
  const restante = arred(100 - alocado);
  if (restante > 0.001) linhas.push(linha("", "restante", restante));
  return linhas;
}

export function totalParticipacao(projeto: Pick<Projeto, "participacao_pct">,
                                  participantes: Pick<Participante, "percentual">[]): number {
  return arred(Number(projeto.participacao_pct) + soma(participantes.map((p) => Number(p.percentual))));
}

function soma(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function arred(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---------------------------------------------------------------------------
// Retorno no tempo: ROI anualizado, TIR e cenários
// ---------------------------------------------------------------------------

/** Abaixo disso, anualizar um retorno de poucas semanas produz número sem sentido. */
export const MESES_MINIMOS_ANUALIZAR = 3;

/**
 * Converte o retorno acumulado do período inteiro em taxa equivalente ao ano:
 * (1 + roi)^(12/meses) − 1. Devolve null com menos de MESES_MINIMOS_ANUALIZAR meses,
 * porque extrapolar poucas semanas para um ano inteiro engana mais do que informa.
 * Receita zero (roi = −1) devolve −1: perdeu tudo, em qualquer prazo.
 */
export function roiAnualizado(roi: number | null, meses: number): number | null {
  if (roi === null || meses < MESES_MINIMOS_ANUALIZAR) return null;
  const base = 1 + roi;
  if (base <= 0) return -1;
  return Math.pow(base, 12 / meses) - 1;
}

/** Valor presente líquido de uma série de fluxos mensais a uma taxa mensal. */
export function vpl(fluxos: number[], taxaMensal: number): number {
  return fluxos.reduce((s, cf, t) => s + cf / Math.pow(1 + taxaMensal, t), 0);
}

/** Teto da busca da TIR: 1000 % ao mês já cobre qualquer caso real. */
const TIR_MAX_MENSAL = 10;

/**
 * TIR mensal por bisseção (taxa que zera o VPL). Devolve null quando a série não
 * troca de sinal — só aportes ou só receitas — ou quando a raiz está fora da faixa
 * pesquisada. Séries com várias trocas de sinal podem ter mais de uma solução;
 * a bisseção devolve a primeira encontrada na faixa.
 */
export function tirMensal(fluxos: number[]): number | null {
  if (fluxos.length < 2) return null;
  if (!fluxos.some((f) => f > 0) || !fluxos.some((f) => f < 0)) return null;

  let lo = -0.9999, hi = TIR_MAX_MENSAL;
  let fLo = vpl(fluxos, lo), fHi = vpl(fluxos, hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const meio = (lo + hi) / 2;
    const fMeio = vpl(fluxos, meio);
    if (fMeio === 0) return meio;
    if (fLo * fMeio < 0) { hi = meio; fHi = fMeio; } else { lo = meio; fLo = fMeio; }
  }
  return (lo + hi) / 2;
}

/** TIR anual equivalente: (1 + tir mensal)^12 − 1. */
export function tirAnual(fluxos: number[]): number | null {
  const m = tirMensal(fluxos);
  return m === null ? null : Math.pow(1 + m, 12) - 1;
}

export const CENARIOS = ["otimista", "base", "pessimista"] as const;
export type TipoCenario = (typeof CENARIOS)[number];

/** Variação aplicada ao cenário otimista/pessimista (frações: 0.15 = 15 %). */
export interface AjusteCenario {
  receita: number;
  /** Desloca tudo que sai: aportes, custo das vendas e despesas. */
  investimento: number;
}

export const AJUSTE_PADRAO: AjusteCenario = { receita: 0.15, investimento: 0.1 };

export interface ResultadoCenario {
  cenario: TipoCenario;
  /** Multiplicadores aplicados à série real, para a tela mostrar o que foi assumido. */
  fatorReceita: number;
  fatorInvestimento: number;
  /** Tudo que saiu no cenário (investimento + custo de vendas + despesas). */
  saidaTotal: number;
  receitaTotal: number;
  saldo: number;
  roi: number | null;
  roiAnualizado: number | null;
  tirAnual: number | null;
  breakeven: string | null;
  meses: number;
}

/**
 * Sensibilidade sobre o fluxo real: não projeta o futuro, apenas repete o histórico
 * com a receita e o investimento deslocados. Otimista vende mais gastando menos;
 * pessimista, o contrário.
 */
export function simularCenarios(fluxo: FluxoMensal[], ajuste: AjusteCenario = AJUSTE_PADRAO): ResultadoCenario[] {
  const fatores: Record<TipoCenario, { receita: number; saida: number }> = {
    otimista: { receita: 1 + ajuste.receita, saida: 1 - ajuste.investimento },
    base: { receita: 1, saida: 1 },
    pessimista: { receita: 1 - ajuste.receita, saida: 1 + ajuste.investimento },
  };
  return CENARIOS.map((cenario) => aplicarCenario(fluxo, cenario, fatores[cenario]));
}

function aplicarCenario(fluxo: FluxoMensal[], cenario: TipoCenario,
                        fator: { receita: number; saida: number }): ResultadoCenario {
  let saidaAcum = 0, recAcum = 0, investAcum = 0;
  const ajustado: FluxoMensal[] = fluxo.map((m) => {
    const investimento = Number(m.investimento) * fator.saida;
    const custo_vendas = Number(m.custo_vendas) * fator.saida;
    const despesas = Number(m.despesas) * fator.saida;
    const saida = investimento + custo_vendas + despesas;
    const receita = Number(m.receita) * fator.receita;
    saidaAcum += saida;
    recAcum += receita;
    investAcum += investimento;
    return {
      mes: m.mes, investimento, custo_vendas, despesas, saida, receita,
      saida_acumulada: saidaAcum, rec_acumulada: recAcum, saldo_acumulado: recAcum - saidaAcum,
    };
  });

  const saldo = arred(recAcum - saidaAcum);
  const meses = ajustado.length;
  return {
    cenario,
    fatorReceita: fator.receita,
    fatorInvestimento: fator.saida,
    saidaTotal: arred(saidaAcum),
    receitaTotal: arred(recAcum),
    saldo,
    // ROI continua sendo sobre o capital aportado, não sobre tudo que saiu.
    roi: investAcum > 0 ? saldo / investAcum : null,
    roiAnualizado: roiAnualizado(investAcum > 0 ? saldo / investAcum : null, meses),
    tirAnual: tirAnual(ajustado.map((m) => m.receita - m.saida)),
    breakeven: encontrarBreakeven(ajustado),
    meses,
  };
}

/** Chave para casar um investimento com a estimativa de IA (mesma regra da coluna item_normalizado). */
export function normalizarItem(item: string): string {
  return item.trim().toLowerCase();
}

/** Diferença relativa do valor lançado em relação à média de mercado: +0.10 = 10 % acima. */
export function desvioVsMedia(valorUnitario: number, valorMedio: number): number | null {
  if (!(valorMedio > 0)) return null;
  return Math.round(((valorUnitario - valorMedio) / valorMedio) * 10000) / 10000;
}
