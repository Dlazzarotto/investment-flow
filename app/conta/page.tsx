import { Shell } from "@/components/Shell";
import { FormAlterarSenha } from "@/components/forms/FormAlterarSenha";
import { EquipeEmpresa } from "@/components/conta/EquipeEmpresa";
import { assentosOcupados, ehMaster, listarCarteira, listarProjetos, minhaOrganizacao, obterUsuario } from "@/lib/consultas";
import { fmtTexto } from "@/lib/i18n";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Conta do próprio usuário (ninguém troca a senha de outra pessoa por aqui) e a
 * equipe da empresa: quem a administra e quantos assentos do plano estão em uso.
 */
export default async function ContaPage() {
  const { d } = obterD();
  const [projetos, usuario, carteira, master, org] = await Promise.all([
    listarProjetos(), obterUsuario(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);

  const usados = org ? await assentosOcupados(org.organizacao.id) : null;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{d.conta.titulo}</h1>
      <p className="mt-1 text-stone">{d.conta.subtitulo}</p>

      <section className="secao max-w-md">
        <h2>{d.login.email}</h2>
        <p className="break-all text-stone">{usuario?.email}</p>
      </section>

      <section className="secao max-w-md">
        <h2>{d.conta.alterarSenha}</h2>
        <p className="mb-4 text-stone">{d.conta.dica}</p>
        <FormAlterarSenha />
      </section>

      {org && (
        <section className="secao max-w-3xl">
          <h2>{d.organizacao.titulo}</h2>
          <p className="text-lg font-semibold text-navy">{org.organizacao.nome}</p>
          <p className="mt-1 text-stone">{fmtTexto(d.organizacao.subtitulo, { empresa: org.organizacao.nome })}</p>
          {usados !== null && (
            <p className="mt-3 font-semibold text-navy">
              {org.organizacao.assentos
                ? fmtTexto(d.organizacao.assentosUso, { usados, total: org.organizacao.assentos })
                : fmtTexto(d.organizacao.assentosSemTeto, { usados })}
            </p>
          )}
          <p className="my-4 rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{d.organizacao.avisoEmail}</p>
          <h3 className="mb-3 text-lg text-navy">{d.organizacao.socios}</h3>
          <EquipeEmpresa organizacaoId={org.organizacao.id} membros={org.membros}
                         emailAtual={(usuario?.email ?? "").trim().toLowerCase()} />
        </section>
      )}
    </Shell>
  );
}
