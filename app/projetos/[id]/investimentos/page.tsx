import { FormInvestimento } from "@/components/forms/FormInvestimento";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Vazio } from "@/components/ui/Vazio";
import { excluirInvestimento } from "@/app/actions/investimentos";
import { listarInvestimentos, mapaUltimasEstimativas, obterProjeto } from "@/lib/consultas";
import { desvioVsMedia, normalizarItem } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function InvestimentosPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [investimentos, estimativas] = await Promise.all([listarInvestimentos(projeto.id), mapaUltimasEstimativas(projeto.id)]);
  const total = investimentos.reduce((s, i) => s + Number(i.valor_total), 0);
  const iaDisponivel = Boolean(process.env.ANTHROPIC_API_KEY);
  const m = projeto.moeda;
  const t = d.investimentos;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>
      <section className="secao">
        <h2>{t.novo}</h2>
        {!iaDisponivel && <p className="mb-4 text-sm text-stone">{t.iaDesativada}</p>}
        <FormInvestimento projetoId={projeto.id} moeda={m} iaDisponivel={iaDisponivel} />
      </section>
      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.cadastrados}</h2>
          <p className="text-stone">{d.comum.total}: <span className="num font-semibold text-navy">{f.moeda(total, m)}</span></p>
        </div>
        {investimentos.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr>
                <th>{d.comum.data}</th><th>{t.item}</th><th>{d.comum.categoria}</th>
                <th className="num">{t.qtd}</th><th className="num">{t.valorUnit}</th>
                <th className="num">{t.mediaIA}</th><th className="num">{t.desvio}</th><th className="num">{t.valorTotal}</th><th></th>
              </tr></thead>
              <tbody>
                {investimentos.map((i) => {
                  const est = estimativas.get(normalizarItem(i.item));
                  const desvio = est ? desvioVsMedia(Number(i.valor_unitario), Number(est.valor_medio)) : null;
                  const corDesvio = desvio === null ? "text-stone" : desvio > 0.15 ? "text-loss" : desvio < -0.15 ? "text-gain" : "";
                  return (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap">{f.data(i.data)}</td>
                      <td className="font-medium">{i.item}</td>
                      <td>{d.enums.categoriaInvestimento[i.categoria]}</td>
                      <td className="num">{f.numero(Number(i.quantidade), 2)}</td>
                      <td className="num">{f.moeda(Number(i.valor_unitario), m)}</td>
                      <td className="num" title={est ? fmtTexto(t.faixa, { min: f.moeda(Number(est.valor_min), m), max: f.moeda(Number(est.valor_max), m), unidade: est.unidade_ref }) : undefined}>
                        {est ? f.moeda(Number(est.valor_medio), m) : "—"}
                      </td>
                      <td className={`num ${corDesvio}`}>{desvio === null ? "—" : `${desvio > 0 ? "+" : ""}${f.pct(desvio)}`}</td>
                      <td className="num font-semibold">{f.moeda(Number(i.valor_total), m)}</td>
                      <td><BotaoExcluir action={excluirInvestimento} id={i.id} projetoId={projeto.id} confirmacao={fmtTexto(t.excluirConfirma, { item: i.item })} rotulo={d.comum.excluir} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-stone">{t.legendaDesvio}</p>
          </div>
        )}
      </section>
    </>
  );
}
