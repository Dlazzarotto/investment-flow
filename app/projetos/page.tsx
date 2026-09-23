import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { FormProjeto } from "@/components/forms/FormProjeto";
import { Vazio } from "@/components/ui/Vazio";
import { criarProjeto } from "@/app/actions/projetos";
import { ehMaster, listarCarteira, listarProjetos, minhaOrganizacao, obterUsuario } from "@/lib/consultas";
import { FormAdicionarSocio, FormCriarOrganizacao } from "@/components/forms/FormOrganizacao";
import { BotaoRemoverSocio } from "@/components/BotaoRemoverSocio";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const [projetos, usuario, org, carteira, master] = await Promise.all([
    listarProjetos(), obterUsuario(), minhaOrganizacao(), listarCarteira(), ehMaster(),
  ]);
  const emailAtual = (usuario?.email ?? "").trim().toLowerCase();
  // Quem só é investidor (nenhum projeto operacional próprio ou compartilhado) vive na carteira.
  // Projeto que você criou conta sempre: o dono pode estar em participantes para
  // registrar os próprios aportes, e isso não pode expulsá-lo da lista de projetos.
  const operacionais = projetos.filter((p) => p.owner_id === usuario?.id || !carteira.some((c) => c.projeto_id === p.id));
  if (operacionais.length === 0 && carteira.length > 0 && !org) redirect("/carteira");
  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master}>
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
                  {usuario && p.owner_id !== usuario.id && (
                    <p className="mt-1 inline-block rounded-md bg-navy-soft px-2 py-1 text-navy">{d.membros.compartilhado}</p>
                  )}
                  <p className="mt-1 text-stone">
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

      <section className="secao max-w-3xl">
        <h2>{d.organizacao.titulo}</h2>
        <p className="mb-4 text-stone">{d.organizacao.subtitulo}</p>
        {org ? (
          <>
            <p className="text-lg font-semibold text-navy">{org.organizacao.nome}</p>
            <p className="mb-4 rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{d.organizacao.avisoEmail}</p>
            <h3 className="mb-3 text-lg text-navy">{d.organizacao.socios}</h3>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>{d.organizacao.emailSocio}</th><th>{d.comum.data}</th><th>{d.comum.acoes}</th></tr></thead>
                <tbody>
                  {org.membros.map((s) => (
                    <tr key={s.id} className={s.email_normalizado === emailAtual ? "bg-navy-soft/60" : ""}>
                      <td className="break-all font-medium">{s.email}</td>
                      <td className="whitespace-nowrap">{f.data(s.criado_em)}</td>
                      <td>{org.membros.length > 1 && (
                        <BotaoRemoverSocio id={s.id} confirmacao={fmtTexto(d.organizacao.removerConfirma, { email: s.email })} rotulo={d.comum.remover} />
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6"><FormAdicionarSocio organizacaoId={org.organizacao.id} /></div>
          </>
        ) : (
          <>
            <p className="mb-4 text-stone">{d.organizacao.semOrganizacao}</p>
            <FormCriarOrganizacao />
          </>
        )}
      </section>
    </Shell>
  );
}
