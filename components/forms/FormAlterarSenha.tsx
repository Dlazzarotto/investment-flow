"use client";
import { alterarSenha } from "@/app/actions/auth";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";

export function FormAlterarSenha() {
  const [estado, formAction] = useAcaoFormulario(alterarSenha);
  // A key limpa os três campos depois da troca — senha não fica na tela.
  return <Campos key={estado.versao} estado={estado} formAction={formAction} />;
}

function Campos({ estado, formAction }: { estado: EstadoFormulario; formAction: (fd: FormData) => void }) {
  const { d } = useI18n();
  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label className="rotulo" htmlFor="senha_atual">{d.conta.senhaAtual}</label>
        <input id="senha_atual" name="senha_atual" type="password" autoComplete="current-password"
               required minLength={6} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">{d.login.novaSenha}</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password"
               required minLength={6} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="repetir">{d.login.repetirSenha}</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password"
               required minLength={6} className="campo" />
      </div>
      <SubmitButton>{d.conta.alterarSenha}</SubmitButton>
      <Mensagem estado={estado} />
    </form>
  );
}
