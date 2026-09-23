"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

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

export async function removerAdmin(fd: FormData): Promise<void> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const org = schemas.uuid.safeParse(fd.get("organizacao_id"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!org.success || !email) return;

  const supabase = createClient();
  // O trigger organizacao_ultimo_socio (0007) recusa remover o último: empresa
  // sem administrador nenhum viraria dado órfão que nem o master alcança.
  const { error } = await supabase.from("organizacao_membros").delete()
    .eq("organizacao_id", org.data).eq("email_normalizado", email);
  if (error) throw new Error(traduzirErroBanco(error, "empresa", d));
  revalidatePath("/master");
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
export async function alternarPagamento(fd: FormData): Promise<void> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const pagar = String(fd.get("pago") ?? "") === "1";

  const supabase = createClient();
  const { error } = await supabase.from("faturas")
    .update({ pago_em: pagar ? String(fd.get("hoje") ?? "").slice(0, 10) || null : null })
    .eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "fatura", d));
  revalidatePath("/master");
}

export async function excluirFatura(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("faturas").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "fatura", d));
  revalidatePath("/master");
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
