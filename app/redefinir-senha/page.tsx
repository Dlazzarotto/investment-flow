import { FormNovaSenha } from "@/components/forms/FormNovaSenha";
import { MolduraEntrada } from "@/components/MolduraEntrada";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Onde o link do e-mail termina. Chegar aqui exige a sessão que /auth/confirmar
 * abriu — o middleware barra quem vier sem ela.
 */
export default function RedefinirSenhaPage() {
  const { d } = obterD();
  return (
    <MolduraEntrada titulo={d.login.novaSenhaTitulo} texto={d.login.novaSenhaTexto}>
      <FormNovaSenha />
    </MolduraEntrada>
  );
}
