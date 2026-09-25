"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { adotarDoMercado, PREFIXO_MERCADO } from "@/lib/adocao";
import type { ActionState } from "@/lib/types";

/**
 * Grava as até 3 commodities que o usuário quer ver no painel (0031). É escolha
 * de quem olha: o RLS só deixa gravar a própria linha, e só para a empresa de
 * que a pessoa é administradora.
 */
export async function salvarCommoditiesPainel(_: ActionState, fd: FormData): Promise<ActionState> {
  const { d } = obterD();
  const org = z.string().uuid().safeParse(fd.get("organizacao_id"));
  if (!org.success) return { ok: false, erro: d.validacao.dadosInvalidos };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: d.comum.semPermissao };
  // Escolha do catálogo do mercado ("mercado:<codigo>") é adotada pela empresa aqui mesmo.
  const ids: string[] = [];
  for (const v of fd.getAll("commodity_id").map(String).filter(Boolean)) {
    let id = v;
    if (v.startsWith(PREFIXO_MERCADO)) {
      const r = await adotarDoMercado(supabase, org.data, v.slice(PREFIXO_MERCADO.length), d);
      if ("erro" in r) return { ok: false, erro: r.erro };
      id = r.id;
    } else if (!z.string().uuid().safeParse(v).success) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  ids.splice(3);
  const { error } = await supabase.from("painel_commodities").upsert(
    { usuario_id: user.id, organizacao_id: org.data, commodity_ids: ids, atualizado_em: new Date().toISOString() },
    { onConflict: "usuario_id" });
  if (error) return { ok: false, erro: fmtTexto(d.banco.falha, { entidade: d.entidades.commodity, msg: error.message }) };
  revalidatePath("/painel");
  revalidatePath("/commodities");
  return { ok: true, sucesso: d.precosPainel.salva };
}
