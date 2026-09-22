import Link from "next/link";
import { Shell } from "@/components/Shell";
import { FormProjeto } from "@/components/forms/FormProjeto";
import { Vazio } from "@/components/ui/Vazio";
import { criarProjeto } from "@/app/actions/projetos";
import { listarProjetos } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projetos = await listarProjetos();
  return (
    <Shell projetos={projetos}>
      <h1 className="text-2xl">{d.projetos.titulo}</h1>
      <p className="mt-1 text-stone">{d.projetos.subtitulo}</p>
      <section className="secao">
        <h2>{d.projetos.meus}</h2>
        {projetos.length === 0 ? (
          <Vazio titulo={d.projetos.vazioTitulo} texto={d.projetos.vazioTexto} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projetos.map((p) => (
              <li key={p.id}>
                <Link href={`/projetos/${p.id}`} className="block min-h-touch rounded-md border border-stone-light bg-white px-5 py-4 hover:border-navy">
                  <p className="text-lg font-semibold text-navy">{p.nome}</p>
                  <p className="mt-1 text-sm text-stone">
                    {fmtTexto(d.projetos.resumoCard, { tipo: d.enums.tipoParceria[p.tipo_parceria], pct: f.numero(p.participacao_pct, 2), moeda: p.moeda, data: f.data(p.data_inicio) })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="secao max-w-3xl">
        <h2>{d.projetos.novo}</h2>
        <FormProjeto action={criarProjeto} />
      </section>
    </Shell>
  );
}
