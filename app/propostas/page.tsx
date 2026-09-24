import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Vazio } from "@/components/ui/Vazio";
import { ehMaster, listarCarteira, listarProjetos, listarPropostasEmpresa, minhaOrganizacao } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Propostas de preço (custeio reverso) no menu principal: precificar é da
 * empresa, não do projeto (decisão do usuário). Hoje cada proposta ainda nasce
 * dentro de um projeto (a cadeia logística é do projeto, 0008) — soltar isso é a
 * etapa seguinte; aqui ficam todas juntas, e cada uma gera o contrato.
 */
export default async function PropostasPage() {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.propostas;
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  if (!org) redirect("/projetos");
  const propostas = await listarPropostasEmpresa(org.organizacao.id);
  const daEmpresa = projetos.filter((p) => p.organizacao_id === org.organizacao.id);

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{t.subtitulo}</p>
      <section className="secao">
        {propostas.length === 0 ? <Vazio titulo={t.vazio} texto={t.vazioTexto} /> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {propostas.map((e) => (
              <li key={e.id}>
                <Link href={`/projetos/${e.projeto_id}/custeio/${e.id}`}
                      className="block min-h-touch rounded-md border border-stone-light bg-white px-5 py-4 hover:border-navy">
                  <p className="text-lg font-semibold text-navy">{e.nome}</p>
                  <p className="mt-1 text-stone">{[e.commodity, e.cliente, e.projeto_nome].filter(Boolean).join(" · ")}</p>
                  <p className="num mt-1">{f.numero(Number(e.volume_total), 0)} {rotuloUnidade(e.unidade, d)} · {e.moeda}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {daEmpresa.length > 0 && (
        <section className="secao">
          <h2>{t.nova}</h2>
          <p className="mb-3 text-stone">{t.novaAjuda}</p>
          <ul className="flex flex-wrap gap-2">
            {daEmpresa.map((p) => (
              <li key={p.id}><Link href={`/projetos/${p.id}/custeio`} className="btn-quieto">{p.nome}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
