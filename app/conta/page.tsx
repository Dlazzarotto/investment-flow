import { Shell } from "@/components/Shell";
import { FormAlterarSenha } from "@/components/forms/FormAlterarSenha";
import { ehMaster, listarCarteira, listarProjetos, obterUsuario } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Conta do próprio usuário. Ninguém troca a senha de outra pessoa por aqui. */
export default async function ContaPage() {
  const { d } = obterD();
  const [projetos, usuario, carteira, master] = await Promise.all([
    listarProjetos(), obterUsuario(), listarCarteira(), ehMaster(),
  ]);

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master}>
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
    </Shell>
  );
}
