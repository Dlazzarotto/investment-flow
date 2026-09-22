import { FormDespesa } from "@/components/forms/FormDespesa";
import { TabelaDespesas } from "@/components/tabelas/TabelaDespesas";
import { listarDespesas, obterPapel, obterProjeto, podeEditar } from "@/lib/consultas";
import { despesasPorCategoria } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { CategoriaDespesa } from "@/lib/types";

export default async function DespesasPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [despesas, papel] = await Promise.all([listarDespesas(projeto.id), obterPapel(projeto.id)]);
  const editavel = podeEditar(papel);
  const total = despesas.reduce((s, x) => s + Number(x.valor), 0);
  const porCategoria = despesasPorCategoria(despesas);
  const m = projeto.moeda;
  const t = d.despesas;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>
      {editavel ? (
        <section className="secao"><h2>{t.nova}</h2><FormDespesa projetoId={projeto.id} moeda={m} /></section>
      ) : (
        <p className="mt-6 rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{d.membros.somenteLeitura}</p>
      )}
      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.cadastradas}</h2>
          <p className="text-stone">{d.comum.total}: <span className="num font-semibold text-navy">{f.moeda(total, m)}</span></p>
        </div>
        <TabelaDespesas despesas={despesas} projetoId={projeto.id} moeda={m} editavel={editavel} />
      </section>
      {porCategoria.length > 0 && (
        <section className="secao">
          <h2>{t.porCategoria}</h2>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>{d.comum.categoria}</th><th className="num">{d.comum.total}</th><th className="num">%</th></tr></thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td className="font-medium">{d.enums.categoriaDespesa[c.categoria as CategoriaDespesa]}</td>
                    <td className="num">{f.moeda(c.valor, m)}</td>
                    <td className="num">{f.pct(total > 0 ? c.valor / total : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
