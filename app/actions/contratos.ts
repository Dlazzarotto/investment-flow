"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState, PapelParte } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/**
 * Contratos comerciais (0018). Quem decide se pode é o banco: RLS por
 * administração da empresa + empresa em dia, e as chaves compostas que recusam
 * contraparte, commodity ou projeto de outra empresa.
 */

export async function criarContrato(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).contratoComercial.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const { comprador_id, vendedor_id, financial_partner_id, ...contrato } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("contratos").insert(contrato).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "contrato", d) };
  const erroPartes = await gravarPartes(contrato.organizacao_id, data.id, { comprador_id, vendedor_id, financial_partner_id });
  // O contrato já existe: melhor abrir a ficha dele com o aviso do que perder o que foi digitado.
  if (erroPartes) redirect(`/contratos/${data.id}?erro=partes`);

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
  const { organizacao_id, comprador_id, vendedor_id, financial_partner_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("contratos")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "contrato", d) };
  // Nenhuma linha: contrato de outra empresa, ou empresa suspensa (o RLS de escrita recusa em silêncio).
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };
  const erroPartes = await gravarPartes(organizacao_id, id.data, { comprador_id, vendedor_id, financial_partner_id });
  if (erroPartes) return { ok: false, erro: erroPartes };

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


/**
 * Traz para a empresa os projetos do usuário que nasceram antes dela (organizacao_id
 * vazio). Sem isso eles não aparecem para contrato: a chave composta da 0018 exige
 * projeto e contrato da MESMA empresa. Só os projetos de que ele é DONO — projeto
 * compartilhado por outra pessoa não muda de empresa por decisão de quem só participa.
 */
export async function trazerProjetosParaEmpresa(fd: FormData): Promise<void> {
  const { d } = obterD();
  const org = criarSchemas(d).uuid.safeParse(fd.get("organizacao_id"));
  if (!org.success) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // O RLS deixa o DONO mudar o projeto para qualquer empresa (o papel dele é
  // "dono" em qualquer caso). Sem esta conferência, um id de outra empresa vindo
  // do formulário enfiaria o projeto dentro dela.
  const { data: minha } = await supabase.rpc("minha_organizacao");
  if (minha !== org.data) throw new Error(d.comum.semPermissao);
  const { error } = await supabase.from("projetos").update({ organizacao_id: org.data })
    .is("organizacao_id", null).eq("owner_id", user.id);
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath("/", "layout");
}

/**
 * Regrava as partes do contrato: uma por papel (comprador, vendedor, Financial
 * Partner). Apaga as que ficaram vazias. Devolve a mensagem de erro, ou null.
 */
async function gravarPartes(organizacaoId: string, contratoId: string,
  partes: { comprador_id: string | null; vendedor_id: string | null; financial_partner_id: string | null }): Promise<string | null> {
  const { d } = obterD();
  const supabase = createClient();
  const porPapel: [PapelParte, string | null][] = [
    ["comprador", partes.comprador_id], ["vendedor", partes.vendedor_id], ["financial_partner", partes.financial_partner_id],
  ];
  const vazios = porPapel.filter(([, c]) => !c).map(([p]) => p);
  if (vazios.length) {
    const { error } = await supabase.from("contrato_partes").delete().eq("contrato_id", contratoId).in("papel", vazios);
    if (error) return traduzirErroBanco(error, "contrato", d);
  }
  const linhas = porPapel.filter(([, c]) => c)
    .map(([papel, cliente_id]) => ({ organizacao_id: organizacaoId, contrato_id: contratoId, papel, cliente_id: cliente_id! }));
  if (linhas.length) {
    const { error } = await supabase.from("contrato_partes").upsert(linhas, { onConflict: "contrato_id,papel" });
    if (error) return traduzirErroBanco(error, "contrato", d);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Instrumentos bancários e monetização (0019)
// ---------------------------------------------------------------------------

export async function criarInstrumento(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).instrumento.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { error } = await supabase.from("instrumentos").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "instrumento", d) };
  revalidatePath(`/contratos/${parsed.data.contrato_id}`);
  revalidatePath("/painel");
  return { ok: true, sucesso: d.instrumentos.salvo };
}

export async function mudarStatusInstrumento(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).statusInstrumento.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("instrumentos")
    .update({ status: parsed.data.status, atualizado_em: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) throw new Error(traduzirErroBanco(error, "instrumento", d));
  revalidatePath("/contratos", "layout");
  revalidatePath("/painel");
}

export async function excluirInstrumento(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("instrumentos").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "instrumento", d));
  revalidatePath("/contratos", "layout");
  revalidatePath("/painel");
}

export async function criarMonetizacao(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).monetizacao.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { error } = await supabase.from("monetizacoes").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "monetizacao", d) };
  revalidatePath("/contratos", "layout");
  revalidatePath("/painel");
  return { ok: true, sucesso: d.monetizacao.salva };
}

export async function mudarStatusMonetizacao(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).statusMonetizacao.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("monetizacoes")
    .update({ status: parsed.data.status, atualizado_em: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) throw new Error(traduzirErroBanco(error, "monetizacao", d));
  revalidatePath("/contratos", "layout");
  revalidatePath("/painel");
}

export async function excluirMonetizacao(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("monetizacoes").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "monetizacao", d));
  revalidatePath("/contratos", "layout");
  revalidatePath("/painel");
}

// ---------------------------------------------------------------------------
// Remuneração da gestão (o que a empresa ganha por administrar um projeto)
// ---------------------------------------------------------------------------

export async function criarRemuneracao(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).remuneracao.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { error } = await supabase.from("remuneracoes_gestao").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "remuneracao", d) };
  revalidatePath(`/projetos/${parsed.data.projeto_id}/participantes`);
  revalidatePath("/painel");
  return { ok: true, sucesso: d.gestao.salva };
}

export async function excluirRemuneracao(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("remuneracoes_gestao").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "remuneracao", d));
  revalidatePath("/projetos", "layout");
  revalidatePath("/painel");
}
