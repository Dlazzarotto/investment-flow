"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { cadastrar, entrar } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function FormLogin({ next }: { next?: string }) {
  const { d } = useI18n();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [estado, formAction] = useFormState(modo === "entrar" ? entrar : cadastrar, { ok: false } as ActionState);
  return (
    <form action={formAction} className="grid gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="rotulo" htmlFor="email">{d.login.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">{d.login.senha}</label>
        <input id="senha" name="senha" type="password" autoComplete={modo === "entrar" ? "current-password" : "new-password"} minLength={6} required className="campo" />
      </div>
      <SubmitButton aguardando={d.login.verificando}>{modo === "entrar" ? d.login.entrar : d.login.criarConta}</SubmitButton>
      <Mensagem estado={estado} />
      <button type="button" onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")} className="btn-quieto">
        {modo === "entrar" ? d.login.irCadastro : d.login.irEntrar}
      </button>
    </form>
  );
}
