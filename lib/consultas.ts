/**
 * Leituras do banco usadas pelas páginas (Server Components) e pela exportação.
 * `cache()` deduplica a mesma leitura dentro de uma requisição (layout + página pedem o mesmo projeto).
 */
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Despesa, EstimativaIA, FluxoMensal, Investimento, PapelNoProjeto, Participante, Projeto, ProjetoMembro, Venda,
} from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Usuário logado (o middleware já garante que existe nas páginas do app). */
export const obterUsuario = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * Papel do usuário logado no projeto: "dono", "editor", "leitor" ou null.
 * Quem decide é o banco (public.papel_no_projeto), a mesma fonte das policies —
 * a tela não pode divergir do que o RLS vai permitir.
 */
export const obterPapel = cache(async (projetoId: string): Promise<PapelNoProjeto> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("papel_no_projeto", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  return (data as PapelNoProjeto) ?? null;
});

export function podeEditar(papel: PapelNoProjeto): boolean {
  return papel === "dono" || papel === "editor";
}

export const listarMembros = cache(async (projetoId: string): Promise<ProjetoMembro[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("projeto_membros").select("*")
    .eq("projeto_id", projetoId).order("email_normalizado");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjetoMembro[];
});

export const listarProjetos = cache(async (): Promise<Projeto[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("projetos").select("*").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Projeto[];
});

/** Projeto do dono logado; id malformado ou de outra conta (RLS) cai em 404, não em erro. */
export const obterProjeto = cache(async (id: string): Promise<Projeto> => {
  if (!UUID.test(id)) notFound();
  const supabase = createClient();
  const { data, error } = await supabase.from("projetos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return data as Projeto;
});

export const listarParticipantes = cache(async (projetoId: string): Promise<Participante[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("participantes").select("*")
    .eq("projeto_id", projetoId).order("percentual", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Participante[];
});

export const listarInvestimentos = cache(async (projetoId: string): Promise<Investimento[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("investimentos").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Investimento[];
});

export const listarVendas = cache(async (projetoId: string): Promise<Venda[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("vendas").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Venda[];
});

export const listarDespesas = cache(async (projetoId: string): Promise<Despesa[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("despesas").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Despesa[];
});

export const obterFluxoMensal = cache(async (projetoId: string): Promise<FluxoMensal[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fluxo_mensal", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FluxoMensal[]).map((f) => ({
    mes: String(f.mes).slice(0, 10),
    investimento: Number(f.investimento),
    custo_vendas: Number(f.custo_vendas),
    despesas: Number(f.despesas),
    saida: Number(f.saida),
    receita: Number(f.receita),
    saida_acumulada: Number(f.saida_acumulada),
    rec_acumulada: Number(f.rec_acumulada),
    saldo_acumulado: Number(f.saldo_acumulado),
  }));
});

/** Última estimativa de IA por item do projeto, indexada por item normalizado (lower/trim). */
export const mapaUltimasEstimativas = cache(async (projetoId: string): Promise<Map<string, EstimativaIA>> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ultimas_estimativas", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  const mapa = new Map<string, EstimativaIA>();
  for (const e of (data ?? []) as EstimativaIA[]) mapa.set(e.item_normalizado, e);
  return mapa;
});
