"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, type Dicionario } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { autorizarComPin } from "./acesso";
import { traduzirErroBanco } from "./erros";

/**
 * Confere o PIN quando ele vem no formulário (papel Escritório). Sem PIN não há o
 * que conferir e quem decide é o RLS.
 */
async function conferirPin(fd: FormData, projetoId: string, d: Dicionario): Promise<string | null> {
  const pin = String(fd.get("pin") ?? "").trim();
  if (!pin) return null;
  return (await autorizarComPin(projetoId, pin)) ? null : d.acesso.pinErrado;
}

// ---------------------------------------------------------------------------
// Cadeia logística do projeto
// ---------------------------------------------------------------------------

export async function criarEtapa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).etapa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("projeto_etapas").insert(parsed.data);
  if (error) return { ok: false, erro: traduzirErroBanco(error, "etapa", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.custeio.etapaSalva, { nome: parsed.data.nome }) };
}

export async function atualizarEtapa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.etapa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { projeto_id, ...campos } = parsed.data;

  const erroPin = await conferirPin(fd, projeto_id, d);
  if (erroPin) return { ok: false, erro: erroPin };

  const supabase = createClient();
  const { data, error } = await supabase.from("projeto_etapas").update(campos)
    .eq("id", id.data).eq("projeto_id", projeto_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "etapa", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${projeto_id}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.custeio.etapaAtualizada, { nome: campos.nome }) };
}

export async function excluirEtapa(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const erroPin = await conferirPin(fd, parsed.data.projeto_id, d);
  if (erroPin) throw new Error(erroPin);

  const supabase = createClient();
  // Os itens lançados nessa etapa não somem: ficam sem etapa (on delete set null).
  const { error } = await supabase.from("projeto_etapas").delete()
    .eq("id", parsed.data.id).eq("projeto_id", parsed.data.projeto_id);
  if (error) throw new Error(traduzirErroBanco(error, "etapa", d));
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
}

// ---------------------------------------------------------------------------
// Estimativa — uma precificação; várias por projeto, uma por cliente/lote
// ---------------------------------------------------------------------------

export async function criarEstimativa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).estimativa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { data, error } = await supabase.from("estimativas_custo").insert(parsed.data).select("id").single();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "estimativa", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  redirect(`/projetos/${parsed.data.projeto_id}/custeio/${data.id}`);
}

export async function atualizarEstimativa(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.estimativa.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };
  const { projeto_id, ...campos } = parsed.data;

  const erroPin = await conferirPin(fd, projeto_id, d);
  if (erroPin) return { ok: false, erro: erroPin };

  const supabase = createClient();
  const { data, error } = await supabase.from("estimativas_custo")
    .update({ ...campos, atualizado_em: new Date().toISOString() })
    .eq("id", id.data).eq("projeto_id", projeto_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "estimativa", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${projeto_id}`, "layout");
  return { ok: true, sucesso: d.custeio.estimativaAtualizada };
}

export async function excluirEstimativa(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const erroPin = await conferirPin(fd, parsed.data.projeto_id, d);
  if (erroPin) throw new Error(erroPin);

  const supabase = createClient();
  const { error } = await supabase.from("estimativas_custo").delete()
    .eq("id", parsed.data.id).eq("projeto_id", parsed.data.projeto_id);
  if (error) throw new Error(traduzirErroBanco(error, "estimativa", d));
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  redirect(`/projetos/${parsed.data.projeto_id}/custeio`);
}

// ---------------------------------------------------------------------------
// Itens de custo
// ---------------------------------------------------------------------------

/**
 * Etapa do item. Vem vazia quando o custo não pertence a trecho nenhum
 * (escritório, tributo). O trigger `item_mesma_cadeia` confere se a etapa é da
 * cadeia do projeto certo; aqui só garantimos que é um uuid.
 */
function etapaDoItem(fd: FormData, uuid: ReturnType<typeof criarSchemas>["uuid"]): string | null | false {
  const v = String(fd.get("etapa_id") ?? "").trim();
  if (!v) return null;
  return uuid.safeParse(v).success ? v : false;
}

export async function criarItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const projetoId = schemas.uuid.safeParse(fd.get("projeto_id"));
  const etapa = etapaDoItem(fd, schemas.uuid);
  if (!projetoId.success || etapa === false) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.estimativaItem.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.from("estimativa_itens").insert({ ...parsed.data, etapa_id: etapa });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "item", d) };

  revalidatePath(`/projetos/${projetoId.data}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.custeio.itemSalvo, { nome: parsed.data.nome }) };
}

export async function atualizarItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  const projetoId = schemas.uuid.safeParse(fd.get("projeto_id"));
  const etapa = etapaDoItem(fd, schemas.uuid);
  if (!id.success || !projetoId.success || etapa === false) return { ok: false, erro: d.validacao.idInvalido };
  const parsed = schemas.estimativaItem.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const erroPin = await conferirPin(fd, projetoId.data, d);
  if (erroPin) return { ok: false, erro: erroPin };

  const supabase = createClient();
  const { data, error } = await supabase.from("estimativa_itens")
    .update({ ...parsed.data, etapa_id: etapa })
    .eq("id", id.data).eq("estimativa_id", parsed.data.estimativa_id).select("id").maybeSingle();
  if (error) return { ok: false, erro: traduzirErroBanco(error, "item", d) };
  if (!data) return { ok: false, erro: d.banco.naoEncontrado };

  revalidatePath(`/projetos/${projetoId.data}`, "layout");
  return { ok: true, sucesso: fmtTexto(d.custeio.itemAtualizado, { nome: parsed.data.nome }) };
}

export async function excluirItem(fd: FormData): Promise<void> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const id = schemas.uuid.safeParse(fd.get("id"));
  const projetoId = schemas.uuid.safeParse(fd.get("projeto_id"));
  if (!id.success || !projetoId.success) return;
  const erroPin = await conferirPin(fd, projetoId.data, d);
  if (erroPin) throw new Error(erroPin);

  const supabase = createClient();
  const { error } = await supabase.from("estimativa_itens").delete().eq("id", id.data);
  if (error) throw new Error(traduzirErroBanco(error, "item", d));
  revalidatePath(`/projetos/${projetoId.data}`, "layout");
}
