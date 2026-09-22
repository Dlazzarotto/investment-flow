"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import type { ActionState } from "@/lib/types";

function credenciais(msgEmail: string, msgSenha: string) {
  return z.object({ email: z.string().trim().email(msgEmail), senha: z.string().min(6, msgSenha) });
}

export async function entrar(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = credenciais(d.login.emailInvalido, d.login.senhaCurta).safeParse({ email: fd.get("email"), senha: fd.get("senha") });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  if (error) return { ok: false, erro: d.login.credenciais };
  const destino = String(fd.get("next") || "/projetos");
  redirect(destino.startsWith("/") ? destino : "/projetos");
}

export async function cadastrar(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = credenciais(d.login.emailInvalido, d.login.senhaCurta).safeParse({ email: fd.get("email"), senha: fd.get("senha") });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.senha });
  if (error) return { ok: false, erro: error.message };
  if (data.session) redirect("/projetos");
  return { ok: true, sucesso: d.login.contaCriada };
}

export async function sair() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
