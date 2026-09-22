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

export async function excluirInvestimento(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("investimentos").delete().eq("id", parsed.data.id);
  if (error) throw new Error(traduzirErroBanco(error, "investimento", d));
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
}
