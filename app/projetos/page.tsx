import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { FormProjeto } from "@/components/forms/FormProjeto";
import { Vazio } from "@/components/ui/Vazio";
import { criarProjeto } from "@/app/actions/projetos";
import { acessoSuspenso, ehMaster, listarCarteira, listarProjetos, minhaOrganizacao, obterResumo, obterUsuario } from "@/lib/consultas";
import { STATUS_PROJETO, type StatusProjeto } from "@/lib/types";
import { FormAdicionarSocio } from "@/components/forms/FormOrganizacao";
import { BotaoRemoverSocio } from "@/components/BotaoRemoverSocio";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjetosPage({ searchParams }: { searchParams: { status?: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const [projetos, usuario, org, carteira, master] = await Promise.all([
    listarProjetos(), obterUsuario(), minhaOrganizacao(), listarCarteira(), ehMaster(),
  ]);
  const suspenso = await acessoSuspenso();
  const emailAtual = (usuario?.email ?? "").trim().toLowerCase();
  // Quem só é investidor (nenhum projeto operacional próprio ou compartilhado) vive na carteira.
  // Projeto que você criou conta sempre: o dono pode estar em participantes para
  // registrar os próprios aportes, e isso não pode expulsá-lo da lista de projetos.
  const operacionais = projetos.filter((p) => p.owner_id === usuario?.id || !carteira.some((c) => c.projeto_id === p.id));
  if (operacionais.length === 0 && carteira.length > 0 && !org) redirect("/carteira");
  // Master sem empresa e sem projeto: a casa dele é /master. Aqui ele só veria o
  // convite para criar uma organização — e dono da plataforma não é cliente dela.
  if (master && !org && projetos.length === 0 && carteira.length === 0) redirect("/master");
  // Projeto é o que a empresa ADMINISTRA (0022): cartão com status e resultado.
  const status = (STATUS_PROJETO as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as StatusProjeto) : null;
  const lista = projetos.filter((p) => !status || p.status === status);
  const resumos = new Map(await Promise.all(lista.map(async (p) => [p.id, await obterResumo(p.id)] as const)));
  const COR: Record<StatusProjeto, string> = {
    em_analise: "bg-orange-soft text-orange-deep", em_andamento: "bg-navy-soft text-navy", encerrado: "bg-stone-light text-stone",
  };
  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      {suspenso && (
        <p role="alert" className="mb-6 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3">
          <strong className="text-loss">{d.comum.acessoSuspenso}</strong>
          <span className="mt-1 block">{d.comum.acessoSuspensoTexto}</span>
        </p>
      )}
      <h1 className="text-2xl">{d.projetos.titulo}</h1>
      <p className="mt-1 text-stone">{d.projetos.subtitulo}</p>
      <nav aria-label={d.projetos.status} className="mt-6 flex flex-wrap gap-2">
        <Link href="/projetos" className={`btn-quieto px-3 ${!status ? "border-navy bg-navy-soft" : ""}`}>
          {d.contratos.todos} ({projetos.length})
        </Link>
        {STATUS_PROJETO.map((x) => (
          <Link key={x} href={`/projetos?status=${x}`} className={`btn-quieto px-3 ${status === x ? "border-navy bg-navy-soft" : ""}`}>
            {d.enums.statusProjeto[x]} ({projetos.filter((p) => p.status === x).length})
          </Link>
        ))}
      </nav>
      <section className="secao">
        {lista.length === 0 ? (
          <Vazio titulo={d.projetos.vazioTitulo} texto={d.projetos.vazioTexto} />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {lista.map((p) => {
              const r = resumos.get(p.id);
              return (
                <li key={p.id}>
                  <Link href={`/projetos/${p.id}`} className="block min-h-touch rounded-md border border-stone-light bg-white px-5 py-4 hover:border-navy">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-navy">{p.nome}</p>
                      <span className={`rounded px-2 py-0.5 text-sm font-semibold ${COR[p.status]}`}>{d.enums.statusProjeto[p.status]}</span>
                    </div>
                    {usuario && p.owner_id !== usuario.id && (
                      <p className="mt-1 inline-block rounded-md bg-navy-soft px-2 py-1 text-navy">{d.membros.compartilhado}</p>
                    )}
                    <p className="mt-1 text-stone">{fmtTexto(d.projetos.cardDesde, { moeda: p.moeda, data: f.data(p.data_inicio) })}</p>
                    {r && (
                      <dl className="mt-2 grid grid-cols-2 gap-2">
                        <div><dt className="text-sm text-stone">{d.resumoProjeto.receita}</dt>
                          <dd className="num font-semibold">{f.moeda(Number(r.receita_total), p.moeda)}</dd></div>
                        <div><dt className="text-sm text-stone">{d.resumoProjeto.saldo}</dt>
                          <dd className={`num font-semibold ${Number(r.saldo) < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(Number(r.saldo), p.moeda)}</dd></div>
                      </dl>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {/* Projeto é da empresa (0025): sem empresa, o banco recusa — a tela não oferece. */}
      {org && (
        <section className="secao max-w-3xl">
          <h2>{d.projetos.novo}</h2>
          <FormProjeto action={criarProjeto} />
        </section>
      )}

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
          // Empresa só nasce pelo master (criar_empresa); a conta avulsa não cria a sua (0025).
          <p role="status" className="rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{d.organizacao.semOrganizacao}</p>
        )}
      </section>
    </Shell>
  );
}
