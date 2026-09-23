"use client";
import Link from "next/link";
import { useFormState } from "react-dom";
import { pedirRedefinicao } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function FormEsqueciSenha() {
  const { d } = useI18n();
  const [estado, formAction] = useFormState(pedirRedefinicao, { ok: false } as ActionState);
  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label className="rotulo" htmlFor="email">{d.login.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <SubmitButton aguardando={d.login.verificando}>{d.login.enviarLink}</SubmitButton>
      <Mensagem estado={estado} />
      <Link href="/login" className="btn-quieto">{d.login.voltarEntrar}</Link>
    </form>
  );
}
