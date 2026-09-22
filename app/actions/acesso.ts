"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { criarSchemas, formParaObjeto, primeiroErro } from "@/lib/validacao";
import type { ActionState } from "@/lib/types";
import { traduzirErroBanco } from "./erros";

/** Tamanho mínimo do PIN — a função definir_pin repete a checagem no banco. */
const PIN_MIN = 6;

/** Cadastra ou troca o PIN do projeto. O texto nunca é gravado: vai para bcrypt no Postgres. */
export async function definirPin(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const schemas = criarSchemas(d);
  const projetoId = schemas.uuid.safeParse(fd.get("projeto_id"));
  if (!projetoId.success) return { ok: false, erro: d.validacao.idInvalido };
  const pin = z.string().min(PIN_MIN, fmtTexto(d.acesso.pinCurto, { min: PIN_MIN })).safeParse(String(fd.get("pin") ?? "").trim());
  if (!pin.success) return { ok: false, erro: primeiroErro(pin.error, d.validacao.dadosInvalidos) };

  const supabase = createClient();
  const { error } = await supabase.rpc("definir_pin", { p_projeto_id: projetoId.data, p_pin: pin.data });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "projeto", d) };

  revalidatePath(`/projetos/${projetoId.data}`, "layout");
  return { ok: true, sucesso: d.acesso.pinSalvo };
}

export async function removerPin(fd: FormData): Promise<void> {
  const { d } = obterD();
  const projetoId = criarSchemas(d).uuid.safeParse(fd.get("projeto_id"));
  if (!projetoId.success) return;
  const supabase = createClient();
  const { error } = await supabase.rpc("remover_pin", { p_projeto_id: projetoId.data });
  if (error) throw new Error(traduzirErroBanco(error, "projeto", d));
  revalidatePath(`/projetos/${projetoId.data}`, "layout");
}

/**
 * Confere o PIN e abre a janela de autorização. Devolvido para as actions de
 * alteração/exclusão chamarem antes de gravar — quem barra de fato é o RLS.
 */
export async function autorizarComPin(projetoId: string, pin: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("autorizar_pin", { p_projeto_id: projetoId, p_pin: pin });
  if (error) return false;
  return Boolean(data);
}

/** Token do convite: 32 bytes aleatórios. Só o sha256 dele fica no banco. */
function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function gerarConvite(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const parsed = criarSchemas(d).convite.safeParse(formParaObjeto(fd));
  if (!parsed.success) return { ok: false, erro: primeiroErro(parsed.error, d.validacao.dadosInvalidos) };

  const token = gerarToken();
  const supabase = createClient();
  const { error } = await supabase.rpc("criar_convite", {
    p_projeto_id: parsed.data.projeto_id, p_token: token, p_papel: parsed.data.papel,
    p_dias: parsed.data.dias, p_max_usos: parsed.data.max_usos,
  });
  if (error) return { ok: false, erro: traduzirErroBanco(error, "membro", d) };

  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
  // O link volta uma única vez, no resultado da action: o token não é recuperável depois.
  return { ok: true, sucesso: `/convite/${token}` };
}

export async function revogarConvite(fd: FormData): Promise<void> {
  const { d } = obterD();
  const parsed = criarSchemas(d).id.safeParse(formParaObjeto(fd));
  if (!parsed.success) return;
  const supabase = createClient();
  const { error } = await supabase.from("convites").update({ revogado: true })
    .eq("id", parsed.data.id).eq("projeto_id", parsed.data.projeto_id);
  if (error) throw new Error(traduzirErroBanco(error, "membro", d));
  revalidatePath(`/projetos/${parsed.data.projeto_id}`, "layout");
}

/** Aceita o convite do link e devolve o projeto, ou null se o convite não serve mais. */
export async function aceitarConvite(token: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
  if (error) return null;
  return (data as string | null) ?? null;
}

/**
 * Entrada pelo link, acionada por um botão — não pela visita à página.
 * Assim nem prefetch do navegador nem robô de prévia de mensagem consomem um uso.
 */
export async function entrarComConvite(fd: FormData): Promise<void> {
  const token = String(fd.get("token") ?? "");
  const projetoId = token ? await aceitarConvite(token) : null;
  redirect(projetoId ? `/projetos/${projetoId}` : "/convite/invalido");
}
