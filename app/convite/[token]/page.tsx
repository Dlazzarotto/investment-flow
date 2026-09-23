import Link from "next/link";
import { entrarComConvite } from "@/app/actions/acesso";
import { MolduraEntrada } from "@/components/MolduraEntrada";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { obterD } from "@/lib/i18n/server";
import { obterUsuario } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/**
 * Tela do link de convite — a única porta de entrada para uma conta nova.
 *
 * É pública: quem é convidado normalmente ainda não tem conta, e mandá-lo para
 * o login primeiro deixava o link sem saída. Continua valendo que ENTRAR é um
 * clique, não a visita: o uso do convite só é gasto no envio do formulário, e
 * por isso prefetch e prévia de link não consomem nada.
 */
export default async function ConvitePage({ params }: { params: { token: string } }) {
  const { d } = obterD();
  const usuario = await obterUsuario();
  const invalido = params.token === "invalido";
  const volta = `/convite/${encodeURIComponent(params.token)}`;

  if (invalido) {
    return (
      <MolduraEntrada titulo={d.acesso.conviteInvalido} texto={d.acesso.conviteInvalidoTexto}>
        <Link href="/login" className="btn-navy">{d.login.voltarEntrar}</Link>
      </MolduraEntrada>
    );
  }

  // Sem conta ainda: as duas portas, carregando o convite para depois do cadastro.
  if (!usuario) {
    return (
      <MolduraEntrada titulo={d.acesso.conviteRecebido} texto={d.login.criarContaTexto}>
        <div className="grid gap-3">
          <Link href={`/criar-conta?next=${encodeURIComponent(volta)}`} className="btn-primario">
            {d.login.irCadastro}
          </Link>
          <Link href={`/login?next=${encodeURIComponent(volta)}`} className="btn-quieto">
            {d.login.irEntrar}
          </Link>
        </div>
      </MolduraEntrada>
    );
  }

  return (
    <MolduraEntrada titulo={d.meta.titulo} texto={d.acesso.convitesTexto}>
      <p className="mb-4 break-all text-center text-stone">{usuario.email}</p>
      <form action={entrarComConvite}>
        <input type="hidden" name="token" value={params.token} />
        <SubmitButton aguardando={d.acesso.entrando}>{d.comum.verProjetos}</SubmitButton>
      </form>
    </MolduraEntrada>
  );
}
