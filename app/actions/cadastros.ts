"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/**
 * Cadastros comerciais da empresa: clientes e fornecedores.
 *
 * O fornecedor é o que faz o sigilo do investidor funcionar. Com o lançamento
 * apontando para ele, o investidor lê serviço, tipo e valor — e o nome fica do
 * outro lado da chave, onde o RLS não deixa ele chegar.
 */

/** `tipos` vem de checkboxes: chega como lista, não como campo único. */
function dadosCliente(fd: FormData) {
  return { ...formParaObjeto(fd), tipos: fd.getAll("tipos").map(String) };
}

export async function criarCliente(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).cliente.safeParse(dadosCliente(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("clientes").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "cliente", d) };

  revalidatePath("/clientes");
  return { ok: true, sucesso: fmtTexto(d.cadastros.clienteSalvo, { nome: parsed.data.nome }) };
}

export async function atualizarCliente(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.cliente.safeParse(dadosCliente(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { organizacao_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("clientes")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "cliente", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath("/clientes");
  return { ok: true, sucesso: fmtTexto(d.cadastros.clienteAtualizado, { nome: campos.nome }) };
}

export async function excluirCliente(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "cliente", d));
  revalidatePath("/clientes");
}

export async function criarFornecedor(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).fornecedor.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("fornecedores").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "fornecedor", d) };

  revalidatePath("/fornecedores");
  return { ok: true, sucesso: fmtTexto(d.cadastros.fornecedorSalvo, { nome: parsed.data.nome }) };
}

export async function atualizarFornecedor(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.fornecedor.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { organizacao_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("fornecedores")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "fornecedor", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath("/fornecedores");
  return { ok: true, sucesso: fmtTexto(d.cadastros.fornecedorAtualizado, { nome: campos.nome }) };
}

export async function excluirFornecedor(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "fornecedor", d));
  revalidatePath("/fornecedores");
}
