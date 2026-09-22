"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

export async function criarProjeto(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).projeto.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { data, error } = await supabase.from("projetos").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "projeto", d) };

  revalidatePath("/projetos");
  redirect(`/projetos/${data.id}`);
}

export async function atualizarProjeto(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const id = String(fd.get("id") ?? "");
  const parsed = criarSchemas(d).projeto.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("projetos").update(parsed.data).eq("id", id);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "projeto", d) };

  revalidatePath(`/projetos/${id}`, "layout");
  revalidatePath("/projetos");
  return { ok: true, sucesso: d.projetos.atualizado };
}

export async function excluirProjeto(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = String(fd.get("id") ?? "");
  const supabase = createClient();
  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath("/projetos");
  redirect("/projetos");
}
