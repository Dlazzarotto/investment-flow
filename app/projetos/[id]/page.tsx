import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { Vazio } from "@/components/ui/Vazio";
import { GraficoFluxo } from "@/components/charts/GraficoFluxo";
import { GraficoBreakeven } from "@/components/charts/GraficoBreakeven";
import { GraficoAlocacao } from "@/components/charts/GraficoAlocacao";
import { listarInvestimentos, listarParticipantes, listarVendas, obterFluxoMensal, obterProjeto } from "@/lib/consultas";
import { Cenarios } from "@/components/Cenarios";
import {
  MESES_MINIMOS_ANUALIZAR, alocacaoPorCategoria, calcularKpis, encontrarBreakeven, ratearParticipacoes,
  roiAnualizado, tirAnual, tirMensal, type Rateio, type TipoRateio,
} from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function DashboardPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [investimentos, vendas, participantes, fluxo] = await Promise.all([
    listarInvestimentos(projeto.id), listarVendas(projeto.id), listarParticipantes(projeto.id), obterFluxoMensal(projeto.id),
  ]);
  const kpis = calcularKpis(investimentos, vendas);
  const breakeven = encontrarBreakeven(fluxo);
  const roiAno = roiAnualizado(kpis.roi, fluxo.length);
  const fluxoLiquido = fluxo.map((x) => x.receita - x.investimento);
  const tir = tirAnual(fluxoLiquido);
  const tirMes = tirMensal(fluxoLiquido);
  const alocacao = alocacaoPorCategoria(investimentos);
  const rateio = ratearParticipacoes(projeto, participantes, kpis);
  const meu = rateio[0];
  const semDados = investimentos.length === 0 && vendas.length === 0;
  const tomSaldo = kpis.saldo > 0 ? "gain" : kpis.saldo < 0 ? "loss" : "neutro";
  const m = projeto.moeda;
  const papel = (tipo: TipoRateio) => tipo === "dono" ? d.enums.tipoParceria[projeto.tipo_parceria]
    : tipo === "restante" ? "—" : d.enums.tipoParticipante[tipo];
  const nomeParte = (r: Rateio) => r.tipo === "dono" ? d.parceria.voce : r.tipo === "restante" ? d.dashboard.naoAlocado : r.nome;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{projeto.nome}</h1>
          <p className="mt-1 text-stone">{fmtTexto(d.projetos.resumoCabecalho, { tipo: d.enums.tipoParceria[projeto.tipo_parceria], pct: f.numero(projeto.participacao_pct, 2) })}</p>
          {projeto.descricao && <p className="mt-2 max-w-2xl text-stone">{projeto.descricao}</p>}
        </div>
        <div className="flex gap-2">
          <a href={`/api/export/${projeto.id}?formato=csv`} className="btn-quieto">{d.dashboard.baixarCsv}</a>
          <a href={`/api/export/${projeto.id}?formato=xlsx`} className="btn-quieto">{d.dashboard.baixarExcel}</a>
        </div>
      </div>

      <section className="mt-8 rounded-md bg-navy px-5 py-6 text-white sm:px-8">
        <p className="text-sm text-white/75">{d.dashboard.saldo}</p>
        <p className={`num mt-1 text-3xl font-semibold leading-none ${kpis.saldo < 0 ? "text-orange" : ""}`}>{f.moeda(kpis.saldo, m)}</p>
        <p className="mt-3 text-base text-white/85">
          {breakeven ? fmtTexto(d.dashboard.breakevenAtingido, { mes: f.mesLongo(breakeven) })
            : kpis.investimentoTotal > 0 ? d.dashboard.breakevenNao : d.dashboard.breakevenSemDados}
        </p>
        {meu.percentual > 0 && (
          <p className="mt-1 text-base text-white/85">
            {fmtTexto(d.dashboard.atribuivel, { pct: f.numero(meu.percentual, 2) })}{" "}
            <span className="num font-semibold text-white">{f.moeda(meu.saldoAtribuivel, m)}</span>
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-3">
        <Kpi rotulo={d.dashboard.investimentoTotal} valor={f.moeda(kpis.investimentoTotal, m)} nota={fmtTexto(d.dashboard.lancamentos, { n: investimentos.length })} />
        <Kpi rotulo={d.dashboard.receitaTotal} valor={f.moeda(kpis.receitaTotal, m)} nota={fmtTexto(d.dashboard.vendasN, { n: vendas.length })} />
        <Kpi rotulo={d.dashboard.roi} valor={f.pct(kpis.roi)} tom={tomSaldo} nota={d.dashboard.roiNota} />
      </section>

      {!semDados && (
        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <Kpi rotulo={d.dashboard.roiAnualizado} valor={f.pct(roiAno)} tom={tomSaldo}
               nota={roiAno === null ? fmtTexto(d.dashboard.roiCurto, { min: MESES_MINIMOS_ANUALIZAR })
                                     : fmtTexto(d.dashboard.roiAnualizadoNota, { meses: fluxo.length })} />
          <Kpi rotulo={d.dashboard.tir} valor={f.pct(tir)} tom={tomSaldo}
               nota={tir === null ? d.dashboard.semTir : fmtTexto(d.dashboard.tirNota, { mensal: f.pct(tirMes) })} />
        </section>
      )}

      {semDados ? (
        <div className="secao"><Vazio titulo={d.dashboard.vazioTitulo} texto={d.dashboard.vazioTexto} /></div>
      ) : (
        <>
          <section className="secao"><h2>{d.dashboard.fluxo}</h2><GraficoFluxo fluxo={fluxo} moeda={m} /></section>
          <section className="secao"><h2>{d.dashboard.breakeven}</h2><GraficoBreakeven fluxo={fluxo} moeda={m} breakeven={breakeven} /></section>
          <section className="secao grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 text-xl">{d.dashboard.alocacao}</h2>
              {alocacao.length === 0 ? <Vazio titulo={d.dashboard.semInvestimentos} texto={d.dashboard.semInvestimentosTexto} /> : <GraficoAlocacao alocacao={alocacao} moeda={m} />}
            </div>
            <div>
              <h2 className="mb-4 text-xl">{d.dashboard.porParticipacao}</h2>
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead><tr><th>{d.dashboard.parte}</th><th>{d.dashboard.papel}</th><th className="num">%</th><th className="num">{d.dashboard.saldoAtribuivel}</th></tr></thead>
                  <tbody>
                    {rateio.map((r, i) => (
                      <tr key={`${r.tipo}-${i}`} className={r.tipo === "restante" ? "text-stone" : ""}>
                        <td className="font-medium">{nomeParte(r)}</td>
                        <td>{papel(r.tipo)}</td>
                        <td className="num">{f.numero(r.percentual, 2)}</td>
                        <td className={`num ${r.saldoAtribuivel < 0 ? "text-loss" : ""}`}>{f.moeda(r.saldoAtribuivel, m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href={`/projetos/${projeto.id}/participantes`} className="mt-3 inline-block text-navy underline">{d.dashboard.gerenciar}</Link>
            </div>
          </section>
          <section className="secao">
            <h2>{d.dashboard.cenarios}</h2>
            <Cenarios fluxo={fluxo} moeda={m} />
          </section>
          <section className="secao">
            <h2>{d.dashboard.tabelaMensal}</h2>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr>
                  <th>{d.dashboard.mes}</th><th className="num">{d.dashboard.investimento}</th><th className="num">{d.dashboard.receita}</th>
                  <th className="num">{d.dashboard.invAcum}</th><th className="num">{d.dashboard.recAcum}</th><th className="num">{d.dashboard.saldoAcum}</th>
                </tr></thead>
                <tbody>
                  {fluxo.map((x) => (
                    <tr key={x.mes}>
                      <td>{f.mesLongo(x.mes)}</td>
                      <td className="num">{f.moeda(x.investimento, m)}</td><td className="num">{f.moeda(x.receita, m)}</td>
                      <td className="num">{f.moeda(x.inv_acumulado, m)}</td><td className="num">{f.moeda(x.rec_acumulada, m)}</td>
                      <td className={`num ${x.saldo_acumulado < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(x.saldo_acumulado, m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
