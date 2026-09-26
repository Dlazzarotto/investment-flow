import Link from "next/link";
import { notFound } from "next/navigation";
import { Lancamentos } from "@/components/custeio/Lancamentos";
import { PainelResultado } from "@/components/custeio/PainelResultado";
import { ParametrosEstimativa } from "@/components/custeio/FormEstimativa";
import { listarEtapas, listarItensEstimativa, obterEstimativa, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";
import { calcularCusteio } from "@/lib/custeio";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function EstimativaPage({ params }: { params: { id: string; estimativaId: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const estimativa = await obterEstimativa(params.estimativaId);
  // A estimativa existe, mas não é deste projeto: a URL foi montada à mão.
  if (estimativa.projeto_id !== projeto.id) notFound();

  const [etapas, itens, papel] = await Promise.all([
    listarEtapas(projeto.id), listarItensEstimativa(estimativa.id), obterPapel(projeto.id),
  ]);
  const pode = permissoes(papel);
  const t = d.custeio;

  const resultado = calcularCusteio(itens, {
    volume_total: Number(estimativa.volume_total),
    producao_diaria: Number(estimativa.producao_diaria),
    dias_mes: estimativa.dias_mes,
    margem_alvo_pct: Number(estimativa.margem_alvo_pct),
  });

  return (
    <>
      <Link href={`/projetos/${projeto.id}/custeio`} className="inline-flex min-h-touch items-center text-navy underline">← {t.voltar}</Link>
      <h1 className="mt-2 text-2xl">{estimativa.nome}</h1>
      <p className="mt-1 text-stone">
        {[estimativa.commodity, estimativa.cliente, d.enums.modoEstimativa[estimativa.modo]].filter(Boolean).join(" · ")}
      </p>
      <p className="num mt-1 text-stone">
        {f.numero(Number(estimativa.volume_total))} {rotuloUnidade(estimativa.unidade, d)} · {estimativa.moeda}
      </p>
      {estimativa.modo === "producao_propria" && Number(estimativa.producao_diaria) > 0 && (
        <p className="num text-stone">
          {fmtTexto(t.producaoDiaria, { unidade: rotuloUnidade(estimativa.unidade, d) })}
          : {f.numero(Number(estimativa.producao_diaria))} · {t.diasMes}: {estimativa.dias_mes}
        </p>
      )}
      {estimativa.observacoes && <p className="mt-2 text-stone">{estimativa.observacoes}</p>}
      <div className="mt-4">
        <ParametrosEstimativa estimativa={estimativa} projetoId={projeto.id}
                              editavel={pode.lancar} pedirPin={pode.alterarComPin} />
      </div>

      <section className="secao">
        <h2>{t.resultado}</h2>
        <PainelResultado resultado={resultado} estimativa={estimativa} />
        {/* A proposta aceita vira contrato: o preço encontrado aqui já vai preenchido.
            Contrato é da administração da empresa, então só quem administra vê o botão. */}
        {pode.administrar && projeto.organizacao_id && (
          <Link href={`/contratos/novo?estimativa=${estimativa.id}`} className="btn-primario mt-4">
            {d.contratos.gerarDaProposta}
          </Link>
        )}
      </section>

      <section className="secao">
        <h2>{t.porEtapa}</h2>
        <Lancamentos estimativa={estimativa} etapas={etapas} itens={itens} resultado={resultado}
                     projetoId={projeto.id} editavel={pode.lancar} pedirPin={pode.alterarComPin} />
      </section>
    </>
  );
}
