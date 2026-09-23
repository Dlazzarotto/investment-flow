import { FormEsqueciSenha } from "@/components/forms/FormEsqueciSenha";
import { MolduraEntrada } from "@/components/MolduraEntrada";
import { obterD } from "@/lib/i18n/server";

export default function EsqueciSenhaPage({ searchParams }: { searchParams: { expirado?: string } }) {
  const { d } = obterD();
  const expirado = searchParams.expirado === "1";
  return (
    <MolduraEntrada titulo={expirado ? d.login.linkExpirado : d.login.recuperarTitulo}
                    texto={expirado ? d.login.linkExpiradoTexto : d.login.recuperarTexto}>
      <FormEsqueciSenha />
    </MolduraEntrada>
  );
}
