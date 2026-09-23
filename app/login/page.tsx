import { FormLogin } from "@/components/forms/FormLogin";
import { MolduraEntrada } from "@/components/MolduraEntrada";
import { obterD } from "@/lib/i18n/server";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { d } = obterD();
  // Sem "criar conta": conta só nasce por convite, e a porta fica em /convite/[token].
  return (
    <MolduraEntrada texto={d.login.subtitulo}>
      <FormLogin next={searchParams.next} />
    </MolduraEntrada>
  );
}
