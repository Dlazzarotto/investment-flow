/**
 * Regras de cálculo puras (sem I/O) — testadas em tests/calculos.test.ts.
 * A agregação mensal contínua é feita no banco por public.fluxo_mensal(); aqui
 * ficam KPIs, break-even e rateio por participação.
 */
import type { FluxoMensal, Investimento, Participante, Projeto, Venda } from "./types";

export interface Kpis {
  investimentoTotal: number;
  receitaTotal: number;
  saldo: number;
  /** (receita − investimento) ÷ investimento; null quando não há investimento */
  roi: number | null;
}

export function calcularKpis(investimentos: Pick<Investimento, "valor_total">[],
                             vendas: Pick<Venda, "receita_total">[]): Kpis {
  const investimentoTotal = soma(investimentos.map((i) => Number(i.valor_total)));
  const receitaTotal = soma(vendas.map((v) => Number(v.receita_total)));
  const saldo = arred(receitaTotal - investimentoTotal);
  return {
    investimentoTotal: arred(investimentoTotal),
    receitaTotal: arred(receitaTotal),
    saldo,
    roi: investimentoTotal > 0 ? saldo / investimentoTotal : null,
  };
}

/** Primeiro mês em que a receita acumulada iguala ou supera o investimento acumulado (>0). */
export function encontrarBreakeven(fluxo: FluxoMensal[]): string | null {
  const hit = fluxo.find((f) => Number(f.inv_acumulado) > 0 && Number(f.rec_acumulada) >= Number(f.inv_acumulado));
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

export interface Rateio {
  nome: string;
  tipo: string;
  percentual: number;
  saldoAtribuivel: number;
  investimentoAtribuivel: number;
  receitaAtribuivel: number;
}

/**
 * Rateia investimento, receita e saldo pela participação de cada parte.
 * A primeira linha é sempre a participação do dono do projeto ("Você").
 * A última linha ("Não alocado") só aparece se a soma for < 100 %.
 */
export function ratearParticipacoes(projeto: Pick<Projeto, "participacao_pct">,
                                    participantes: Pick<Participante, "nome" | "tipo" | "percentual">[],
                                    kpis: Kpis): Rateio[] {
  const linha = (nome: string, tipo: string, pct: number): Rateio => ({
    nome, tipo, percentual: pct,
    saldoAtribuivel: arred(kpis.saldo * pct / 100),
    investimentoAtribuivel: arred(kpis.investimentoTotal * pct / 100),
    receitaAtribuivel: arred(kpis.receitaTotal * pct / 100),
  });
  const linhas = [linha("Você", "dono", Number(projeto.participacao_pct))];
  for (const p of participantes) linhas.push(linha(p.nome, p.tipo, Number(p.percentual)));
  const alocado = soma(linhas.map((l) => l.percentual));
  const restante = arred(100 - alocado);
  if (restante > 0.001) linhas.push(linha("Não alocado", "restante", restante));
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

/** Chave para casar um investimento com a estimativa de IA (mesma regra da coluna item_normalizado). */
export function normalizarItem(item: string): string {
  return item.trim().toLowerCase();
}

/** Diferença relativa do valor lançado em relação à média de mercado: +0.10 = 10 % acima. */
export function desvioVsMedia(valorUnitario: number, valorMedio: number): number | null {
  if (!(valorMedio > 0)) return null;
  return Math.round(((valorUnitario - valorMedio) / valorMedio) * 10000) / 10000;
}
