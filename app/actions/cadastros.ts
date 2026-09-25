"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";
import { adotarDoMercado } from "@/lib/adocao";

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

// ---------------------------------------------------------------------------
// Commodities e os parâmetros de qualidade
// ---------------------------------------------------------------------------

export async function criarCommodity(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).commodity.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { data, error } = await supabase.from("commodities").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "commodity", d) };

  revalidatePath("/commodities");
  // O contrato cria commodity sem sair da tela e já a seleciona: precisa do id.
  revalidatePath("/contratos", "layout");
  return { ok: true, sucesso: fmtTexto(d.cadastros.commoditySalva, { nome: parsed.data.nome }), id: data.id };
}

/**
 * Adota uma commodity do catálogo do mercado (0030): cria a da empresa com o nome
 * no idioma de quem clicou, o grupo, a unidade e a referência de preço do catálogo.
 * Se a empresa já tem uma com o mesmo nome, liga essa ao catálogo em vez de duplicar.
 */
export async function adotarCommodity(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const org = schemas.uuid.safeParse(fd.get("organizacao_id"));
  if (!org.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const r = await adotarDoMercado(createClient(), org.data, String(fd.get("codigo") ?? ""), d);
  if ("erro" in r) return { ok: false, erro: r.erro };
  return { ok: true, sucesso: fmtTexto(d.cadastros.commoditySalva, { nome: r.nome }), id: r.id };
}

export async function atualizarCommodity(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.commodity.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { organizacao_id, ...campos } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.from("commodities")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "commodity", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath("/commodities");
  return { ok: true, sucesso: fmtTexto(d.cadastros.commodityAtualizada, { nome: campos.nome }) };
}

export async function excluirCommodity(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("commodities").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "commodity", d));
  revalidatePath("/commodities");
}

export async function criarParametro(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).parametro.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("commodity_parametros").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "parametro", d) };

  revalidatePath("/commodities");
  return { ok: true, sucesso: fmtTexto(d.cadastros.parametroSalvo, { nome: parsed.data.nome }) };
}

export async function excluirParametro(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("commodity_parametros").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "parametro", d));
  revalidatePath("/commodities");
}

// ---------------------------------------------------------------------------
// Grupos, grades e locais (0029)
// ---------------------------------------------------------------------------

export async function criarGrupo(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).grupoCommodity.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { data, error } = await supabase.from("commodity_grupos").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "grupoCommodity", d) };
  revalidatePath("/commodities");
  return { ok: true, sucesso: fmtTexto(d.cadastros.grupoSalvo, { nome: parsed.data.nome }), id: data.id };
}

/** Só grupo da empresa se exclui (o RLS recusa os padrão); as commodities dele ficam sem grupo. */
export async function excluirGrupo(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("commodity_grupos").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "grupoCommodity", d));
  revalidatePath("/commodities");
}

export async function criarGrade(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).grade.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { data, error } = await supabase.from("commodity_grades").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "grade", d) };
  revalidatePath("/commodities");
  revalidatePath("/contratos", "layout");
  return { ok: true, sucesso: fmtTexto(d.cadastros.gradeSalvo, { nome: parsed.data.nome }), id: data.id };
}

export async function excluirGrade(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("commodity_grades").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "grade", d));
  revalidatePath("/commodities");
}

export async function criarLocal(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).local.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { data, error } = await supabase.from("locais").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "local", d) };
  revalidatePath("/locais");
  revalidatePath("/contratos", "layout");
  return { ok: true, sucesso: fmtTexto(d.cadastros.localSalvo, { nome: parsed.data.nome }), id: data.id };
}

export async function atualizarLocal(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.local.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { organizacao_id, ...campos } = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.from("locais").update(campos)
    .eq("id", id.data).eq("organizacao_id", organizacao_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "local", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };
  revalidatePath("/locais");
  return { ok: true, sucesso: fmtTexto(d.cadastros.localAtualizado, { nome: campos.nome }) };
}

export async function excluirLocal(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("locais").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "local", d));
  revalidatePath("/locais");
}

// ---------------------------------------------------------------------------
// Documentos do cliente (0021): o navegador sobe o arquivo ao bucket privado
// (as políticas do Storage conferem a empresa); aqui só se registra o que ele é.
// ---------------------------------------------------------------------------

export async function registrarDocumento(meta: Record<string, string>): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).documentoCliente.safeParse(meta);
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const supabase = createClient();
  const { error } = await supabase.from("cliente_documentos").insert(parsed.data);
  if (error) {
    // Sem registro, o arquivo ficaria órfão no bucket: sai também.
    await supabase.storage.from("documentos").remove([parsed.data.caminho]);
    return { ok: false, erro: traduzirErroBanco(error, "documento", d) };
  }
  revalidatePath("/clientes");
  return { ok: true, sucesso: d.documentos.salvo };
}

export async function excluirDocumento(fd: FormData): Promise<void> {
  const { d } = obterD();
  const id = criarSchemas(d).uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  const supabase = createClient();
  const { data, error } = await supabase.from("cliente_documentos").delete().eq("id", id.data).select("caminho").maybeSingle();
  if (error) throw new Error(traduzirErroBanco(error, "documento", d));
  if (data?.caminho) {
    const { error: e2 } = await supabase.storage.from("documentos").remove([data.caminho]);
    if (e2) throw new Error(fmtTexto(d.banco.falha, { entidade: d.entidades.documento, msg: e2.message }));
  }
  revalidatePath("/clientes");
}
