"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";
import { mesmoNome } from "@/lib/texto";

/**
 * Libera uma empresa nova e senta o ADM dela.
 *
 * Vai por RPC e não por dois inserts: a empresa nasceria sem dono se o segundo
 * falhasse, e o caminho comum (`criar_organizacao`) poria o MASTER como membro
 * — justamente o que a decisão de não-leitura quer evitar.
 */
export async function criarEmpresa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).empresa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { nome, email_adm, plano, assentos, vigencia_ate } = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.rpc("criar_empresa", {
    p_nome: nome, p_email_adm: email_adm, p_plano: plano,
    p_assentos: assentos, p_vigencia_ate: vigencia_ate,
  });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };

  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.empresaCriada, { nome, email: email_adm }) };
}

/** Plano, assentos, vigência e o liga/desliga. O trigger do banco só aceita do master. */
export async function atualizarContrato(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).contrato.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("organizacoes").update(campos)
    .eq("id", id).select("nome").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.contratoSalvo, { nome: data.nome as string }) };
}

/** Mais um administrador para a empresa (sócio, substituto, quem o cliente pedir). */
export async function adicionarAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).organizacaoMembro.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("organizacao_membros")
    .insert({ organizacao_id: parsed.data.organizacao_id, email: parsed.data.email.toLowerCase() });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };

  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.adminAdicionado, { email: parsed.data.email }) };
}

/**
 * Remove um administrador. O banco recusa o último (0007): empresa sem ninguém
 * vira dado órfão. Devolve a mensagem em vez de lançar — lançar derrubava a
 * página inteira com "Algo deu errado".
 */
export async function removerAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const org = criarSchemas(d).uuid.safeParse(fd.get("organizacao_id"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!org.success || !email) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data, error } = await supabase.from("organizacao_membros").delete()
    .eq("organizacao_id", org.data).eq("email_normalizado", email).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };
  if (!data?.length) return { ok: false, erro: d.banco.naoEncontrado };
  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.adminRemovido, { email }) };
}

/**
 * Troca o e-mail de um administrador: inclui o novo e só então tira o antigo.
 * Nessa ordem a empresa nunca fica sem ninguém — e trocar o ÚNICO administrador
 * funciona, o que "remover e adicionar" não deixava.
 */
export async function trocarAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).organizacaoMembro.safeParse(formParaObjeto(fd));
  const antigo = String(fd.get("email_antigo") ?? "").trim().toLowerCase();
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const novo = parsed.data.email.trim().toLowerCase();
  if (!antigo || novo === antigo) return { ok: false, erro: d.validacao.dadosInvalidos };

  const supabase = createClient();
  // Troca o e-mail NA MESMA LINHA: inserir o novo antes de apagar o antigo esbarrava
  // no teto de assentos (plano de 1 assento nunca trocava o ADM). O índice único
  // global (0027) continua barrando e-mail que já é de outra empresa.
  const { data, error } = await supabase.from("organizacao_membros").update({ email: novo })
    .eq("organizacao_id", parsed.data.organizacao_id).eq("email_normalizado", antigo).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };
  if (!data?.length) return { ok: false, erro: d.comum.nadaAlterado };
  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.adminTrocado, { antigo, novo }) };
}

/**
 * Exclui empresa criada por engano ou para teste. O banco (excluir_empresa, 0028)
 * só aceita empresa VAZIA — tudo o que é dela sai em cascata, então empresa com
 * dados se suspende, não se exclui. O nome digitado confere que é a empresa certa.
 */
export async function excluirEmpresa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  if (!mesmoNome(String(fd.get("confirmacao") ?? ""), String(fd.get("nome") ?? ""))) {
    return { ok: false, erro: d.master.excluirEmpresaNome };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("excluir_empresa", { p_organizacao_id: id.data });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "empresa", d) };
  if (!data) return { ok: false, erro: d.master.empresaComDados };
  revalidatePath("/master");
  return { ok: true, sucesso: d.master.empresaExcluida };
}

// ---------------------------------------------------------------------------
// Faturamento
// ---------------------------------------------------------------------------

export async function criarFatura(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).fatura.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("faturas").insert(parsed.data);
  // 23505: já existe a mensalidade daquele mês — o índice único é quem garante.
  if (error) return { ok: false, erro: error.code === "23505" ? d.master.faturaDuplicada : traduzirErroBanco(error, "fatura", d) };

  revalidatePath("/master");
  return { ok: true, sucesso: d.master.faturaCriada };
}

/** Liga e desliga a baixa: informar o pagamento e desfazer usam o mesmo caminho. */
export async function alternarPagamento(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const pagar = String(fd.get("pago") ?? "") === "1";

  const supabase = createClient();
  const { error } = await supabase.from("faturas")
    .update({ pago_em: pagar ? String(fd.get("hoje") ?? "").slice(0, 10) || null : null })
    .eq("id", id.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "fatura", d) };
  revalidatePath("/master");
  return { ok: true };
}

export async function excluirFatura(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data: apagados, error } = await supabase.from("faturas").delete().eq("id", id.data).select("id");
  if (error) return { ok: false, erro: traduzirErroBanco(error, "fatura", d) };
  // RLS que recusa um delete não dá erro: devolve zero linhas. Dizer, em vez de fingir que excluiu.
  if (!apagados?.length) return { ok: false, erro: d.comum.nadaAlterado };
  revalidatePath("/master");
  return { ok: true };
}

/** Emite a mensalidade do mês de quem está em dia. Rodar duas vezes não duplica. */
export async function gerarMensalidades(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const competencia = String(fd.get("competencia") ?? "").slice(0, 10) || null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("gerar_mensalidades",
    competencia ? { p_competencia: competencia } : {});
  if (error) return { ok: false, erro: traduzirErroBanco(error, "fatura", d) };

  revalidatePath("/master");
  return { ok: true, sucesso: fmtTexto(d.master.mensalidadesGeradas, { n: Number(data ?? 0) }) };
}
