"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, type Dicionario } from "@/lib/i18n";
import { caminhoInterno } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";

function credenciais(msgEmail: string, msgSenha: string) {
  return z.object({ email: z.string().trim().email(msgEmail), senha: z.string().min(6, msgSenha) });
}

/** Traduz os erros mais comuns do Supabase Auth no cadastro (códigos estáveis da auth-js). */
function traduzirErroCadastro(err: AuthError, d: Dicionario): string {
  switch (err.code) {
    case "user_already_exists":
    case "email_exists": return d.login.jaCadastrado;
    case "weak_password": return d.login.senhaFraca;
    // São esperas bem diferentes: o limite de e-mail do Supabase é de 2 por hora
    // no projeto inteiro; o de requisições passa em minutos.
    case "over_email_send_rate_limit": return d.login.limiteEmails;
    case "over_request_rate_limit": return d.login.limiteTentativas;
    case "signup_disabled": return d.login.cadastroDesativado;
    case "email_address_invalid":
    case "validation_failed": return d.login.emailInvalido;
    default: return fmtTexto(d.login.falhaCadastro, { msg: err.message });
  }
}

export async function entrar(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = credenciais(d.login.emailInvalido, d.login.senhaCurta).safeParse({ email: fd.get("email"), senha: fd.get("senha") });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  if (error) return { ok: false, erro: d.login.credenciais };
  redirect(caminhoInterno(fd.get("next")));
}

export async function cadastrar(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = credenciais(d.login.emailInvalido, d.login.senhaCurta).safeParse({ email: fd.get("email"), senha: fd.get("senha") });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.senha });
  if (error) return { ok: false, erro: traduzirErroCadastro(error, d) };
  if (data.session) redirect("/projetos");
  return { ok: true, sucesso: d.login.contaCriada };
}

export async function sair() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
