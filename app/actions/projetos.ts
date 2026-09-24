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
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.projeto.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  // .select() devolve a linha alterada; sem linha = projeto inexistente ou de outra conta (RLS)
  const { data, error } = await supabase.from("projetos").update(parsed.data).eq("id", id.data).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "projeto", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${id.data}`, "layout");
  revalidatePath("/projetos");
  return { ok: true, sucesso: d.projetos.atualizado };
}

export async function excluirProjeto(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("projetos").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath("/projetos");
  redirect("/projetos");
}

/** Status do projeto (0022): em análise, em andamento, encerrado — é o que o painel conta. */
export async function mudarStatusProjeto(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).statusProjeto.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("projetos").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath(`/projetos/${parsed.data.id}`, "layout");
  revalidatePath("/projetos");
  revalidatePath("/painel");
}
