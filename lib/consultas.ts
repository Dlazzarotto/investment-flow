/** Leituras do banco usadas pelas páginas (Server Components) e pela exportação. */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstimativaIA, FluxoMensal, Investimento, Participante, Projeto, Venda } from "@/lib/types";

export async function listarProjetos(): Promise<Projeto[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projetos").select("*").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Projeto[];
}

export async function obterProjeto(id: string): Promise<Projeto> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projetos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return data as Projeto;
}

export async function listarParticipantes(projetoId: string): Promise<Participante[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("participantes").select("*")
    .eq("projeto_id", projetoId).order("percentual", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Participante[];
}

export async function listarInvestimentos(projetoId: string): Promise<Investimento[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("investimentos").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Investimento[];
}

export async function listarVendas(projetoId: string): Promise<Venda[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("vendas").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Venda[];
}

export async function obterFluxoMensal(projetoId: string): Promise<FluxoMensal[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fluxo_mensal", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FluxoMensal[]).map((f) => ({
    mes: String(f.mes).slice(0, 10),
    investimento: Number(f.investimento),
    receita: Number(f.receita),
    inv_acumulado: Number(f.inv_acumulado),
    rec_acumulada: Number(f.rec_acumulada),
    saldo_acumulado: Number(f.saldo_acumulado),
  }));
}

/** Última estimativa de IA por item do projeto, indexada por item normalizado (lower/trim). */
export async function mapaUltimasEstimativas(projetoId: string): Promise<Map<string, EstimativaIA>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ultimas_estimativas", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  const mapa = new Map<string, EstimativaIA>();
  for (const e of (data ?? []) as EstimativaIA[]) mapa.set(e.item_normalizado, e);
  return mapa;
}
