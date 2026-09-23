import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterPapel, podeEditar } from "@/lib/consultas";
import { sugerirCusto } from "@/lib/ia/custo";
import { obterD } from "@/lib/i18n/server";
import type { Dicionario } from "@/lib/i18n";
import { DRIVERS_CUSTO, type EstimativaCusto, type ProjetoEtapa } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const entradaSchema = (d: Dicionario) => z.object({
  estimativa_id: z.string().uuid(d.validacao.idInvalido),
  etapa_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  tipo: z.enum(["cargo", "servico"]),
  descricao: z.string().trim().min(2, d.custeio.informeDescricao).max(160, d.validacao.nomeLongo),
  driver: z.enum(DRIVERS_CUSTO),
});

/**
 * POST /api/ia/custo — quanto custa um cargo (pela legislação do país da etapa) ou
 * um serviço, já na base do driver escolhido. Não grava: quem grava é o formulário.
 */
export async function POST(req: NextRequest) {
  const { locale, d } = obterD();
  const corpo = await req.json().catch(() => null);
  const parsed = entradaSchema(d).safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? d.validacao.dadosInvalidos }, { status: 400 });
  }
  const { estimativa_id, etapa_id, tipo, descricao, driver } = parsed.data;

  // O RLS já esconde a estimativa de quem não pode ver o custeio (investidor).
  const supabase = createClient();
  const { data: est, error } = await supabase.from("estimativas_custo").select("*")
    .eq("id", estimativa_id).maybeSingle();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!est) return NextResponse.json({ erro: d.banco.naoEncontrado }, { status: 404 });
  const e = est as EstimativaCusto;

  // Barrar aqui evita gastar a chamada à Claude API para o RLS recusar o insert depois.
  if (!podeEditar(await obterPapel(e.projeto_id))) {
    return NextResponse.json({ erro: d.comum.semPermissao }, { status: 403 });
  }

  let etapa: ProjetoEtapa | null = null;
  if (etapa_id) {
    const { data } = await supabase.from("projeto_etapas").select("*")
      .eq("id", etapa_id).eq("projeto_id", e.projeto_id).maybeSingle();
    etapa = (data as ProjetoEtapa | null) ?? null;
  }
  // Sem etapa escolhida, o país da primeira etapa da cadeia ainda é melhor que nada.
  let pais = etapa?.pais ?? null;
  if (!pais) {
    const { data } = await supabase.from("projeto_etapas").select("pais")
      .eq("projeto_id", e.projeto_id).not("pais", "is", null).order("ordem").limit(1).maybeSingle();
    pais = (data as { pais: string } | null)?.pais ?? null;
  }

  try {
    const { resultado, modelo } = await sugerirCusto({
      tipo, descricao, driver, pais, commodity: e.commodity, moeda: e.moeda,
      unidadeProduto: e.unidade, locale,
      etapa: etapa ? [etapa.nome, etapa.origem, etapa.destino].filter(Boolean).join(" · ") : null,
    }, d);
    return NextResponse.json({ resultado, modelo, pais });
  } catch (err) {
    return NextResponse.json({ erro: err instanceof Error ? err.message : d.ia.falha }, { status: 502 });
  }
}
