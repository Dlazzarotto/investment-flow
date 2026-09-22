import { FormInvestimento } from "@/components/forms/FormInvestimento";
import { TabelaInvestimentos, type LinhaInvestimento } from "@/components/tabelas/TabelaInvestimentos";
import { listarInvestimentos, mapaUltimasEstimativas, obterPapel, obterProjeto, podeEditar } from "@/lib/consultas";
import { normalizarItem } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function InvestimentosPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [investimentos, estimativas, papel] = await Promise.all([
    listarInvestimentos(projeto.id), mapaUltimasEstimativas(projeto.id), obterPapel(projeto.id),
  ]);
  const editavel = podeEditar(papel);
  const total = investimentos.reduce((s, i) => s + Number(i.valor_total), 0);
  const iaDisponivel = Boolean(process.env.ANTHROPIC_API_KEY);
  const m = projeto.moeda;
  const t = d.investimentos;

  // O Map de estimativas não atravessa a fronteira servidor → cliente: vira campo da linha.
  const linhas: LinhaInvestimento[] = investimentos.map((investimento) => {
    const e = estimativas.get(normalizarItem(investimento.item));
    return {
      investimento,
      media: e ? {
        valor_min: Number(e.valor_min), valor_medio: Number(e.valor_medio),
        valor_max: Number(e.valor_max), unidade_ref: e.unidade_ref,
      } : null,
    };
  });

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>
      {editavel ? (
        <section className="secao">
          <h2>{t.novo}</h2>
          {!iaDisponivel && <p className="mb-4 text-stone">{t.iaDesativada}</p>}
          <FormInvestimento projetoId={projeto.id} moeda={m} iaDisponivel={iaDisponivel} />
        </section>
      ) : (
        <p className="mt-6 rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{d.membros.somenteLeitura}</p>
      )}
      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.cadastrados}</h2>
          <p className="text-stone">{d.comum.total}: <span className="num font-semibold text-navy">{f.moeda(total, m)}</span></p>
        </div>
        <TabelaInvestimentos linhas={linhas} projetoId={projeto.id} moeda={m} editavel={editavel} />
      </section>
    </>
  );
}
