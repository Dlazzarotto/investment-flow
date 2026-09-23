"use client";
import Link from "next/link";
import { useFormState } from "react-dom";
import { cadastrar } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function FormCriarConta({ next }: { next?: string }) {
  const { d } = useI18n();
  const [estado, formAction] = useFormState(cadastrar, { ok: false } as ActionState);
  const entrar = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="rotulo" htmlFor="email">{d.login.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">{d.login.senha}</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={6} required className="campo" />
      </div>
      <SubmitButton aguardando={d.login.verificando}>{d.login.criarConta}</SubmitButton>
      <Mensagem estado={estado} />
      <Link href={entrar} className="btn-quieto">{d.login.irEntrar}</Link>
    </form>
  );
}
