import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterPapel, podeEditar } from "@/lib/consultas";
import { estimarValorMedio } from "@/lib/ia/estimativa";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import type { EstimativaIA, Projeto } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const entradaSchema = (msgItem: string) => z.object({
  projeto_id: z.string().uuid(),
  item: z.string().trim().min(2, msgItem).max(160),
  contexto: z.string().trim().max(500).optional().transform((v) => v || null),
});

/** POST /api/ia/estimar — pesquisa o valor médio de mercado do item e grava a estimativa. */
export async function POST(req: NextRequest) {
  const { locale, d } = obterD();
  const corpo = await req.json().catch(() => null);
  const parsed = entradaSchema(d.ia.informeItem).safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? d.validacao.dadosInvalidos }, { status: 400 });
  }
  const supabase = createClient();
  const { data: projeto, error: erroProj } = await supabase.from("projetos").select("*")
    .eq("id", parsed.data.projeto_id).maybeSingle();
  if (erroProj) return NextResponse.json({ erro: erroProj.message }, { status: 500 });
  if (!projeto) return NextResponse.json({ erro: d.banco.naoEncontrado }, { status: 404 });
  const p = projeto as Projeto;

  // Quem só lê o projeto não grava estimativa — barrar aqui evita gastar a chamada à
  // Claude API para depois o RLS recusar o insert.
  if (!podeEditar(await obterPapel(p.id))) {
    return NextResponse.json({ erro: d.comum.semPermissao }, { status: 403 });
  }

  let resultado, modelo;
  try {
    ({ resultado, modelo } = await estimarValorMedio({
      item: parsed.data.item, contexto: parsed.data.contexto, moeda: p.moeda,
      nomeProjeto: p.nome, descricaoProjeto: p.descricao, locale,
    }, d));
  } catch (e) {
    const msg = e instanceof Error ? e.message : d.ia.falha;
    return NextResponse.json({ erro: msg }, { status: 502 });
  }

  const { data: salvo, error } = await supabase.from("estimativas_ia").insert({
    projeto_id: p.id, item: parsed.data.item, contexto: parsed.data.contexto, moeda: p.moeda,
    unidade_ref: resultado.unidade_ref, valor_min: resultado.valor_min, valor_medio: resultado.valor_medio,
    valor_max: resultado.valor_max, confianca: resultado.confianca, premissas: resultado.premissas,
    fontes: resultado.fontes, modelo,
  }).select("*").single();
  if (error) return NextResponse.json({ erro: fmtTexto(d.ia.naoSalva, { msg: error.message }) }, { status: 500 });

  return NextResponse.json({ estimativa: salvo as EstimativaIA, observacao: resultado.observacao });
}
