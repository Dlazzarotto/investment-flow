"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

export async function criarDespesa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).despesa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("despesas").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "despesa", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.despesas.salva, { descricao: parsed.data.descricao }) };
}

export async function atualizarDespesa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.despesa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  // projeto_id serve só para revalidar: editar não move o lançamento de projeto.
  const { projeto_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("despesas").update(campos)
    .eq("id", id.data).eq("projeto_id", projeto_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "despesa", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.despesas.atualizada, { descricao: campos.descricao }) };
}

export async function excluirDespesa(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("despesas").delete().eq("id", parsed.data.id);
  if (error) throw new Error(traduzirErroBanco(error, "despesa", d));
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
}
