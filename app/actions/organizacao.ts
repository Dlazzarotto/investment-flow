"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/** Organização do usuário logado, ou null. Usada para conferir antes de gravar. */
async function minhaOrganizacaoId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc("minha_organizacao");
  return (data as string | null) ?? null;
}

/** Cria a organização dos sócios; quem cria já entra como sócio (função criar_organizacao). */
export async function criarOrganizacao(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).organizacao.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  // criar_organizacao recusa quem já é sócio com errcode unique_violation, que o
  // tradutor leria como "já existe uma com esse nome" — motivo errado. Conferimos antes.
  if (await minhaOrganizacaoId()) return { ok: false, erro: d.organizacao.jaTemUma };

  const supabase = createClient();
  const { error } = await supabase.rpc("criar_organizacao", { p_nome: parsed.data.nome });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "organizacao", d) };

  revalidatePath("/", "layout");
  return { ok: true, sucesso: fmtTexto(d.organizacao.criada, { nome: parsed.data.nome }) };
}

/** Adiciona um sócio (admin em todos os projetos da organização) pelo e-mail confirmado da conta dele. */
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

export async function removerSocio(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("organizacao_membros").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "socio", d));
  revalidatePath("/", "layout");
}

/**
 * Vincula ou desvincula um projeto da organização (só dono/admin do projeto, pelo RLS).
 * Só aceita a organização do próprio usuário: vincular a uma organização de terceiros
 * daria a todos os sócios dela o papel de admin neste projeto.
 */
export async function vincularOrganizacao(fd: FormData): Promise<void> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const projetoId = schemas.uuid.safeParse(fd.get("projeto_id"));
  if (!projetoId.success) return;

  const bruto = String(fd.get("organizacao_id") ?? "").trim();
  let organizacaoId: string | null = null;
  if (bruto) {
    const alvo = schemas.uuid.safeParse(bruto);
    if (!alvo.success) return;
    if (alvo.data !== (await minhaOrganizacaoId())) throw new Error(d.comum.semPermissao);
    organizacaoId = alvo.data;
  }

  const supabase = createClient();
  const { error } = await supabase.from("projetos").update({ organizacao_id: organizacaoId }).eq("id", projetoId.data);
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath("/", "layout");
}
