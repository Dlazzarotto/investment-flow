"use client";
import { Cenarios } from "@/components/Cenarios";
import { GraficoAlocacao } from "@/components/charts/GraficoAlocacao";
import { GraficoBreakeven } from "@/components/charts/GraficoBreakeven";
import { GraficoFluxo } from "@/components/charts/GraficoFluxo";
import { Vazio } from "@/components/ui/Vazio";
import { encontrarBreakeven } from "@/lib/calculos";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import type { FluxoMensal, Moeda } from "@/lib/types";

/**
 * Análise do projeto, dentro do Resumo (decisão do usuário: o que é do projeto fica
 * no projeto; as negociações da empresa seguem no painel principal).
 *
 * Fonte: fluxo_mensal() — só lançamentos com data (capex, vendas, despesas). Contrato
 * concluído está no resultado do topo, não no mês a mês; a nota diz isso na tela.
 * Os gráficos repetem os números numa tabela: o laranja da marca fica abaixo de 3:1
 * contra o fundo, e a tabela é a leitura que não depende de cor.
 */
export function AnaliseProjeto({ fluxo, moeda, alocacao }:
  { fluxo: FluxoMensal[]; moeda: Moeda; alocacao: { categoria: string; valor: number }[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.resumoProjeto;
  const x = d.exportacao;
  const breakeven = encontrarBreakeven(fluxo);

  return (
    <section className="secao">
      <h2>{t.analise}</h2>
      <p className="mb-4 text-stone">{t.analiseNota}</p>
      {fluxo.length === 0 ? <Vazio titulo={t.semFluxoTitulo} texto={t.semFluxoTexto} /> : (
        <div className="grid grid-cols-1 gap-8">
          <figure className="min-w-0">
            <figcaption className="mb-2 font-semibold text-navy">{t.graficoFluxo}</figcaption>
            <GraficoFluxo fluxo={fluxo} moeda={moeda} />
          </figure>
          <figure className="min-w-0">
            <figcaption className="mb-2 font-semibold text-navy">
              {t.graficoBreakeven} · {breakeven ? fmtTexto(t.breakevenEm, { mes: f.mesCurto(breakeven) }) : t.breakevenAinda}
            </figcaption>
            <GraficoBreakeven fluxo={fluxo} moeda={moeda} breakeven={breakeven} />
          </figure>
          <details>
            <summary className="inline-flex min-h-touch cursor-pointer items-center font-semibold text-navy">{t.verTabela}</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>{x.mes}</th><th className="num">{x.saida}</th><th className="num">{x.receitaMes}</th>
                    <th className="num">{x.saidaAcum}</th><th className="num">{x.recAcum}</th><th className="num">{x.saldoAcum}</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxo.map((m) => (
                    <tr key={m.mes}>
                      <td className="whitespace-nowrap">{f.mesCurto(m.mes)}</td>
                      <td className="num">{f.moeda(m.saida, moeda)}</td>
                      <td className="num">{f.moeda(m.receita, moeda)}</td>
                      <td className="num">{f.moeda(m.saida_acumulada, moeda)}</td>
                      <td className="num">{f.moeda(m.rec_acumulada, moeda)}</td>
                      <td className={`num font-semibold ${m.saldo_acumulado < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(m.saldo_acumulado, moeda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {alocacao.length > 0 && (
            <figure className="min-w-0">
              <figcaption className="mb-2 font-semibold text-navy">{t.graficoAlocacao}</figcaption>
              <GraficoAlocacao alocacao={alocacao} moeda={moeda} />
            </figure>
          )}
          <div>
            <h3 className="mb-2 text-lg text-navy">{t.cenarios}</h3>
            <Cenarios fluxo={fluxo} moeda={moeda} />
          </div>
        </div>
      )}
    </section>
  );
}
