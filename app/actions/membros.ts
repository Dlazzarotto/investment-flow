"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/** Convida um sócio por e-mail. Quem valida de verdade é o RLS: só o dono passa. */
export async function convidarMembro(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).membro.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { data, error } = await supabase.from("projeto_membros").insert(parsed.data).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "membro", d) };
  // Sem erro e sem linha = o insert não passou pelo RLS (quem tentou não é o dono).
  if (!data) return { ok: false, erro: d.comum.semPermissao };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.membros.convidado, { email: parsed.data.email }) };
}

export async function removerMembro(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data: apagados, error } = await supabase.from("projeto_membros").delete()
    .eq("id", parsed.data.id).eq("projeto_id", parsed.data.projeto_id).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "membro", d) };
  // RLS que recusa um delete não dá erro: devolve zero linhas. Dizer, em vez de fingir que excluiu.
  if (!apagados?.length) return { ok: false, erro: d.comum.nadaAlterado };
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true };
}
