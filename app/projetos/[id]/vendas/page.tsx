import { FormVenda } from "@/components/forms/FormVenda";
import { TabelaVendas } from "@/components/tabelas/TabelaVendas";
import { listarVendas, obterPapel, obterProjeto, podeEditar } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function VendasPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [vendas, papel] = await Promise.all([listarVendas(projeto.id), obterPapel(projeto.id)]);
  const editavel = podeEditar(papel);
  const total = vendas.reduce((s, v) => s + Number(v.receita_total), 0);
  const m = projeto.moeda;
  const t = d.vendas;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>
      {editavel ? (
        <section className="secao"><h2>{t.nova}</h2><FormVenda projetoId={projeto.id} moeda={m} /></section>
      ) : (
        <p className="mt-6 rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{d.membros.somenteLeitura}</p>
      )}
      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.historico}</h2>
          <p className="text-stone">{d.comum.total}: <span className="num font-semibold text-navy">{f.moeda(total, m)}</span></p>
        </div>
        <TabelaVendas vendas={vendas} projetoId={projeto.id} moeda={m} editavel={editavel} />
      </section>
    </>
  );
}
