"use server";
import { headers } from "next/headers";
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
  // Depois de confirmar o e-mail, a pessoa volta para onde estava indo — o
  // convite, quase sempre. Sem isto ela cairia na raiz sem saber o que fazer.
  const destino = caminhoInterno(fd.get("next"));
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.senha,
    options: { emailRedirectTo: `${origemDaRequisicao()}/auth/confirmar?next=${encodeURIComponent(destino)}` },
  });
  if (error) return { ok: false, erro: traduzirErroCadastro(error, d) };
  if (data.session) redirect(destino);
  return { ok: true, sucesso: d.login.contaCriada };
}

/**
 * Pede o link de recuperação de senha.
 *
 * A resposta é a MESMA existindo ou não a conta: dizer "esse e-mail não existe"
 * entrega a quem perguntar quais sócios têm acesso ao sistema.
 */
export async function pedirRedefinicao(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const email = z.string().trim().email(d.login.emailInvalido).safeParse(fd.get("email"));
  if (!email.success) return { ok: false, erro: email.error.issues[0].message };

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origemDaRequisicao()}/auth/confirmar?next=/redefinir-senha`,
  });
  // Limite de envio é a única falha que vale contar: o usuário precisa saber que é só esperar.
  if (error?.code === "over_email_send_rate_limit") return { ok: false, erro: d.login.limiteEmails };
  if (error?.code === "over_request_rate_limit") return { ok: false, erro: d.login.limiteTentativas };
  return { ok: true, sucesso: d.login.linkEnviado };
}

export async function redefinirSenha(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const senha = String(fd.get("senha") ?? "");
  if (senha.length < 6) return { ok: false, erro: d.login.senhaCurta };
  if (senha !== String(fd.get("repetir") ?? "")) return { ok: false, erro: d.login.senhasDiferentes };

  const supabase = createClient();
  // A sessão aqui é a de recuperação, aberta pelo link do e-mail.
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (error.code === "weak_password") return { ok: false, erro: d.login.senhaFraca };
    return { ok: false, erro: fmtTexto(d.login.falhaCadastro, { msg: error.message }) };
  }
  redirect("/projetos");
}

export async function sair() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Origem desta requisição — o link do e-mail precisa voltar para o mesmo host. */
function origemDaRequisicao(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
