import Link from "next/link";
import { Cadeia } from "@/components/custeio/Cadeia";
import { FormEstimativa } from "@/components/custeio/FormEstimativa";
import { Vazio } from "@/components/ui/Vazio";
import { listarEstimativas, listarEtapas, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function CusteioPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const [etapas, estimativas, papel] = await Promise.all([
    listarEtapas(projeto.id), listarEstimativas(projeto.id), obterPapel(projeto.id),
  ]);
  const pode = permissoes(papel);
  const t = d.custeio;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>

      <section className="secao">
        <h2>{t.cadeia}</h2>
        <Cadeia etapas={etapas} projetoId={projeto.id} editavel={pode.lancar} pedirPin={pode.alterarComPin} />
      </section>

      <section className="secao">
        <h2>{t.estimativas}</h2>
        <p className="mb-4 text-stone">{t.estimativasAjuda}</p>
        {estimativas.length === 0 ? (
          <Vazio titulo={t.semEstimativas} texto={t.semEstimativasTexto} />
        ) : (
          <ul className="grid gap-3">
            {estimativas.map((e) => (
              <li key={e.id}>
                <Link href={`/projetos/${projeto.id}/custeio/${e.id}`}
                      className="flex min-h-touch flex-wrap items-center justify-between gap-3 rounded-md border border-stone-light bg-white p-4 hover:bg-navy-soft">
                  <div>
                    <p className="font-semibold text-navy">{e.nome}</p>
                    <p className="text-stone">
                      {[e.commodity, e.cliente, d.enums.modoEstimativa[e.modo]].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-navy">
                      {f.numero(Number(e.volume_total))} {rotuloUnidade(e.unidade, d)}
                    </p>
                    <p className="num text-stone">
                      {e.moeda} · {t.margemAlvo}: {f.pct(Number(e.margem_alvo_pct) / 100)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pode.lancar && (
        <section className="secao">
          <h2>{t.novaEstimativa}</h2>
          <FormEstimativa projetoId={projeto.id} moedaPadrao={projeto.moeda} />
        </section>
      )}
    </>
  );
}
