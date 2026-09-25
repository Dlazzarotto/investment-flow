import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { minhaOrganizacao } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { especificacaoDoGrade } from "@/lib/catalogo";
import { montarPergunta, montarPerguntaBolsas, type IdiomaPesquisa } from "@/lib/pesquisa";
import { adotarDoMercado, PREFIXO_MERCADO } from "@/lib/adocao";
import { iniciarPesquisa, pesquisaConfigurada } from "@/lib/ia/pesquisador";
import type { Commodity, CommodityGrade, CommodityParametro } from "@/lib/types";

export const dynamic = "force-dynamic";

const entrada = z.object({
  // uuid da commodity da empresa, ou "mercado:<codigo>" do catálogo — adotada aqui antes de pesquisar.
  commodity_id: z.union([z.string().uuid(), z.string().regex(/^mercado:[a-z0-9_]{2,40}$/)]),
  grade_id: z.union([z.literal(""), z.string().uuid()]).optional().transform((x) => x || null),
  base: z.string().trim().max(160).optional().transform((x) => x || null),
  detalhado: z.boolean().optional().default(false),
  modo: z.enum(["livre", "bolsas"]).optional().default("livre"),
});

/**
 * POST /api/pesquisa-mercado — abre uma sessão do agente para a commodity e
 * devolve o id da pesquisa. Quem pode é a administração da empresa em dia (o RLS
 * do insert decide); a sessão só é aberta DEPOIS do insert aceito, para não gastar
 * pesquisa que o banco ia recusar.
 */
export async function POST(req: NextRequest) {
  const { locale, d } = obterD();
  if (!pesquisaConfigurada()) return NextResponse.json({ erro: d.pesquisa.naoConfigurada }, { status: 503 });
  const parsed = entrada.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: d.validacao.dadosInvalidos }, { status: 400 });
  const org = await minhaOrganizacao();
  if (!org) return NextResponse.json({ erro: d.comum.semPermissao }, { status: 403 });

  const supabase = createClient();
  let commodityId = parsed.data.commodity_id;
  if (commodityId.startsWith(PREFIXO_MERCADO)) {
    const r = await adotarDoMercado(supabase, org.organizacao.id, commodityId.slice(PREFIXO_MERCADO.length), d);
    if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: 403 });
    commodityId = r.id;
  }
  const { data: c } = await supabase.from("commodities").select("*")
    .eq("id", commodityId).eq("organizacao_id", org.organizacao.id).maybeSingle();
  if (!c) return NextResponse.json({ erro: d.banco.naoEncontrado }, { status: 404 });
  const commodity = c as Commodity;
  let grade: CommodityGrade | null = null;
  if (parsed.data.grade_id) {
    const { data: g } = await supabase.from("commodity_grades").select("*")
      .eq("id", parsed.data.grade_id).eq("commodity_id", commodity.id).maybeSingle();
    grade = (g as CommodityGrade | null) ?? null;
  }
  const { data: ps } = await supabase.from("commodity_parametros").select("*").eq("commodity_id", commodity.id);
  const spec = especificacaoDoGrade((ps ?? []) as CommodityParametro[], commodity.id, grade?.id ?? null).itens.map((p) =>
    [p.nome, p.minimo !== null ? `≥ ${p.minimo} ${p.unidade}` : null, p.maximo !== null ? `≤ ${p.maximo} ${p.unidade}` : null,
     p.referencia !== null ? `(ref. ${p.referencia} ${p.unidade})` : null].filter(Boolean).join(" "));

  const bolsas = parsed.data.modo === "bolsas";
  const idioma = locale as IdiomaPesquisa;
  // No painel a base é a de cada bolsa, não uma escolhida pelo usuário.
  const base = bolsas ? null : parsed.data.base;
  const pergunta = bolsas
    ? montarPerguntaBolsas({ commodity: commodity.nome, grade: grade?.nome, especificacao: spec, idioma })
    : montarPergunta({
      commodity: commodity.nome, grade: grade?.nome, especificacao: spec, base,
      referencia: commodity.bolsa, idioma, detalhado: parsed.data.detalhado,
    });
  const { data: linha, error } = await supabase.from("pesquisas_mercado").insert({
    organizacao_id: org.organizacao.id, commodity_id: commodity.id, grade_id: grade?.id ?? null,
    base, pergunta, idioma: locale, modo: parsed.data.modo,
  }).select("id").single();
  if (error) return NextResponse.json({ erro: fmtTexto(d.banco.falha, { entidade: d.entidades.commodity, msg: error.message }) }, { status: 403 });

  try {
    const sessaoId = await iniciarPesquisa(pergunta, `${org.organizacao.nome} · ${commodity.nome}${grade ? ` ${grade.nome}` : ""}`,
      { pesquisa_id: linha.id, organizacao_id: org.organizacao.id });
    await supabase.from("pesquisas_mercado").update({ sessao_id: sessaoId }).eq("id", linha.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 900) : d.pesquisa.falhouGenerico;
    await supabase.from("pesquisas_mercado").update({ status: "falhou", erro: msg, concluida_em: new Date().toISOString() }).eq("id", linha.id);
    return NextResponse.json({ erro: fmtTexto(d.pesquisa.falhou, { msg }) }, { status: 502 });
  }
  return NextResponse.json({ id: linha.id, commodity_id: commodity.id });
}
