"use client";
import { useFormState } from "react-dom";
import { redefinirSenha } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function FormNovaSenha() {
  const { d } = useI18n();
  const [estado, formAction] = useFormState(redefinirSenha, { ok: false } as ActionState);
  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label className="rotulo" htmlFor="senha">{d.login.novaSenha}</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={6} required className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="repetir">{d.login.repetirSenha}</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={6} required className="campo" />
      </div>
      <SubmitButton aguardando={d.comum.salvando}>{d.login.salvarSenha}</SubmitButton>
      <Mensagem estado={estado} />
    </form>
  );
}
