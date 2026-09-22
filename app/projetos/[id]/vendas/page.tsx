import { FormVenda } from "@/components/forms/FormVenda";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Vazio } from "@/components/ui/Vazio";
import { excluirVenda } from "@/app/actions/vendas";
import { listarVendas, obterProjeto } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { UNIDADES_VOLUME } from "@/lib/types";

export default async function VendasPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const vendas = await listarVendas(projeto.id);
  const total = vendas.reduce((s, v) => s + Number(v.receita_total), 0);
  const m = projeto.moeda;
  const t = d.vendas;
  const unidade = (u: string) => (UNIDADES_VOLUME as readonly string[]).includes(u) ? d.enums.unidades[u as (typeof UNIDADES_VOLUME)[number]] : u;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>
      <section className="secao"><h2>{t.nova}</h2><FormVenda projetoId={projeto.id} moeda={m} /></section>
      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.historico}</h2>
          <p className="text-stone">{d.comum.total}: <span className="num font-semibold text-navy">{f.moeda(total, m)}</span></p>
        </div>
        {vendas.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr>
                <th>{d.comum.data}</th><th>{d.comum.categoria}</th><th className="num">{t.volume}</th><th>{d.comum.unidade}</th>
                <th className="num">{t.precoUnit}</th><th className="num">{t.receita}</th><th></th>
              </tr></thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{f.data(v.data)}</td>
                    <td>{d.enums.categoriaReceita[v.categoria]}</td>
                    <td className="num">{f.numero(Number(v.volume), 2)}</td>
                    <td>{unidade(v.unidade)}</td>
                    <td className="num">{f.moeda(Number(v.preco_unitario), m)}</td>
                    <td className="num font-semibold">{f.moeda(Number(v.receita_total), m)}</td>
                    <td><BotaoExcluir action={excluirVenda} id={v.id} projetoId={projeto.id} confirmacao={fmtTexto(t.excluirConfirma, { data: f.data(v.data) })} rotulo={d.comum.excluir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
