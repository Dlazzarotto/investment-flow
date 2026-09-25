"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

export async function criarInvestimento(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).investimento.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("investimentos").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "investimento", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.investimentos.salvo, { item: parsed.data.item }) };
}

export async function atualizarInvestimento(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.investimento.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  // projeto_id serve só para revalidar: editar não move o lançamento de projeto.
  const { projeto_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("investimentos").update(campos)
    .eq("id", id.data).eq("projeto_id", projeto_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "investimento", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.investimentos.atualizado, { item: campos.item }) };
}

export async function excluirInvestimento(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data: apagados, error } = await supabase.from("investimentos").delete().eq("id", parsed.data.id).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "investimento", d) };
  // RLS que recusa um delete não dá erro: devolve zero linhas. Dizer, em vez de fingir que excluiu.
  if (!apagados?.length) return { ok: false, erro: d.comum.nadaAlterado };
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true };
}
