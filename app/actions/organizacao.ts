"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/**
 * Adiciona um administrador da empresa pelo e-mail confirmado da conta dele. O banco
 * confere o limite de assentos do plano (0009) e que o e-mail não é de outra empresa (0027).
 */
export async function adicionarSocio(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).organizacaoMembro.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("organizacao_membros").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "socio", d) };

  revalidatePath("/", "layout");
  return { ok: true, sucesso: fmtTexto(d.organizacao.socioAdicionado, { email: parsed.data.email }) };
}

/** Devolve a mensagem em vez de lançar: lançar derrubava a página em "Algo deu errado". */
export async function removerSocio(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const supabase = createClient();
  const { data, error } = await supabase.from("organizacao_membros").delete().eq("id", id.data).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "socio", d) };
  if (!data?.length) return { ok: false, erro: d.banco.naoEncontrado };
  revalidatePath("/", "layout");
  return { ok: true, sucesso: d.organizacao.removido };
}
