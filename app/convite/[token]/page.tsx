import { entrarComConvite } from "@/app/actions/acesso";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { obterD } from "@/lib/i18n/server";
import { obterUsuario } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/**
 * Tela do link de convite. O middleware já garante que só chega aqui quem está
 * logado; entrar de fato é um clique, para prefetch e prévia de link não gastarem
 * um uso do convite.
 */
export default async function ConvitePage({ params }: { params: { token: string } }) {
  const { locale, d } = obterD();
  const usuario = await obterUsuario();
  const invalido = params.token === "invalido";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-6 flex justify-end"><SeletorIdioma atual={locale} escuro={false} /></div>
      <p className="text-stone">{d.login.marca}</p>
      <h1 className="mt-1 text-2xl">{invalido ? d.acesso.conviteInvalido : d.meta.titulo}</h1>
      {invalido ? (
        <>
          <p className="mt-3 text-stone">{d.acesso.conviteInvalidoTexto}</p>
          <a href="/projetos" className="btn-navy mt-8">{d.comum.verProjetos}</a>
        </>
      ) : (
        <>
          <p className="mt-3 text-stone">{d.acesso.convitesTexto}</p>
          {usuario?.email && <p className="mt-2 break-all text-stone">{usuario.email}</p>}
          <form action={entrarComConvite} className="mt-8">
            <input type="hidden" name="token" value={params.token} />
            <SubmitButton aguardando={d.acesso.entrando}>{d.comum.verProjetos}</SubmitButton>
          </form>
        </>
      )}
    </main>
  );
}
