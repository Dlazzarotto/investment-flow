"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

export async function criarParticipante(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).participante.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("participantes").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "participante", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.parceria.adicionado, { nome: parsed.data.nome }) };
}

export async function excluirParticipante(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data: apagados, error } = await supabase.from("participantes").delete().eq("id", parsed.data.id).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "participante", d) };
  // RLS que recusa um delete não dá erro: devolve zero linhas. Dizer, em vez de fingir que excluiu.
  if (!apagados?.length) return { ok: false, erro: d.comum.nadaAlterado };
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true };
}
