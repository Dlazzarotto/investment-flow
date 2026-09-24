"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/**
 * Contratos comerciais (0018). Quem decide se pode é o banco: RLS por
 * administração da empresa + empresa em dia, e a trigger que recusa contraparte,
 * commodity, projeto ou estimativa de outra empresa.
 */

export async function criarContrato(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).contratoComercial.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { data, error } = await supabase.from("contratos").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "contrato", d) };

  revalidatePath("/contratos");
  revalidatePath("/painel");
  redirect(`/contratos/${data.id}`);
}

export async function atualizarContrato(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.contratoComercial.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { organizacao_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("contratos")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "contrato", d) };
  // Nenhuma linha: contrato de outra empresa, ou empresa suspensa (o RLS de escrita recusa em silêncio).
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath("/contratos");
  revalidatePath(`/contratos/${id.data}`);
  revalidatePath("/painel");
  return { ok: true, sucesso: d.contratos.atualizado };
}

export async function excluirContrato(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("contratos").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "contrato", d));
  revalidatePath("/contratos");
  revalidatePath("/painel");
  redirect("/contratos");
}

