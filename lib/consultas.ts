/**
 * Leituras do banco usadas pelas páginas (Server Components) e pela exportação.
 * `cache()` deduplica a mesma leitura dentro de uma requisição (layout + página pedem o mesmo projeto).
 */
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { permissoes } from "@/lib/permissoes";
import type {
  Aporte, CarteiraItem, Convite, Despesa, EstimativaCusto, EstimativaIA, EstimativaItem, FluxoMensal, Investimento, Organizacao,
  Cliente, ClienteDocumento, Commodity, CommodityParametro, Contrato, ContratoParte, Instrumento, Monetizacao, RemuneracaoGestao, EmpresaPlataforma, Fatura, Fornecedor, OrganizacaoMembro,
  PainelEmpresa, PainelPlataforma, PapelNoProjeto, Participante, Projeto, ProjetoEtapa, ProjetoMembro, ResumoProjeto, Venda,
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

/** Atalho usado pelas telas de lançamento; a regra completa está em lib/permissoes.ts. */
export function podeEditar(papel: PapelNoProjeto): boolean {
  return permissoes(papel).lancar;
}

/** Existe PIN cadastrado no projeto? (só o boolean — o hash nunca sai do banco) */
export const projetoTemPin = cache(async (projetoId: string): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("tem_pin", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  return Boolean(data);
});

export const listarConvites = cache(async (projetoId: string): Promise<Convite[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("convites").select("*")
    .eq("projeto_id", projetoId).order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Convite[];
});

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

// ---------------------------------------------------------------------------
// 0007 — organização, aportes, resumo e carteira
// ---------------------------------------------------------------------------

export const listarAportes = cache(async (projetoId: string): Promise<Aporte[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("aportes").select("*")
    .eq("projeto_id", projetoId).order("data").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Aporte[];
});

/** Totais do projeto via função security definer — funciona para qualquer papel, inclusive investidor. */
export const obterResumo = cache(async (projetoId: string): Promise<ResumoProjeto> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("resumo_projeto", { p_projeto_id: projetoId });
  if (error) throw new Error(error.message);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) notFound();
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    investimento_total: n("investimento_total"), receita_total: n("receita_total"),
    custo_vendas_total: n("custo_vendas_total"), despesas_total: n("despesas_total"),
    saida_total: n("saida_total"), saldo: n("saldo"), aportes_total: n("aportes_total"),
  };
});

/**
 * Organização do usuário logado (com os sócios), ou null se ainda não criou/entrou em uma.
 *
 * Pela FILIAÇÃO (minha_organizacao(), a mesma que o banco usa para vincular projeto
 * novo), não por "a primeira que o RLS deixa ver": o master enxerga TODAS as
 * empresas (0009), e a primeira visível seria a empresa mais antiga da plataforma
 * — de outra pessoa. O /painel chamaria painel_empresa() com ela e cairia no erro.
 */
export const minhaOrganizacao = cache(async (): Promise<{ organizacao: Organizacao; membros: OrganizacaoMembro[] } | null> => {
  const supabase = createClient();
  const { data: id, error: e0 } = await supabase.rpc("minha_organizacao");
  if (e0) throw new Error(e0.message);
  if (!id) return null;
  const { data: org, error } = await supabase.from("organizacoes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  const organizacao = (org ?? null) as Organizacao | null;
  if (!organizacao) return null;
  const { data: membros, error: e2 } = await supabase.from("organizacao_membros").select("*")
    .eq("organizacao_id", organizacao.id).order("criado_em");
  if (e2) throw new Error(e2.message);
  return { organizacao, membros: (membros ?? []) as OrganizacaoMembro[] };
});

/** Projetos em que o usuário logado é participante (investidor), com posição consolidada. */
export const listarCarteira = cache(async (): Promise<CarteiraItem[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("minha_carteira");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    projeto_id: String(r.projeto_id), nome: String(r.nome), moeda: r.moeda as CarteiraItem["moeda"],
    tipo_parceria: r.tipo_parceria as CarteiraItem["tipo_parceria"], data_inicio: String(r.data_inicio).slice(0, 10),
    participante_id: String(r.participante_id), participante_nome: String(r.participante_nome),
    minha_pct: Number(r.minha_pct), meus_aportes: Number(r.meus_aportes),
    investimento_total: Number(r.investimento_total), receita_total: Number(r.receita_total),
    saida_total: Number(r.saida_total), saldo: Number(r.saldo), saldo_atribuivel: Number(r.saldo_atribuivel),
  }));
});

export const listarEstimativas = cache(async (projetoId: string): Promise<EstimativaCusto[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("estimativas_custo").select("*")
    .eq("projeto_id", projetoId).order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EstimativaCusto[];
});

/** Estimativa pelo id; 404 quando não existe ou o RLS esconde. */
export const obterEstimativa = cache(async (id: string): Promise<EstimativaCusto> => {
  if (!UUID.test(id)) notFound();
  const supabase = createClient();
  const { data, error } = await supabase.from("estimativas_custo").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return data as EstimativaCusto;
});

export const listarItensEstimativa = cache(async (estimativaId: string): Promise<EstimativaItem[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("estimativa_itens").select("*")
    .eq("estimativa_id", estimativaId).order("grupo").order("ordem").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as EstimativaItem[];
});

export const listarEtapas = cache(async (projetoId: string): Promise<ProjetoEtapa[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("projeto_etapas").select("*")
    .eq("projeto_id", projetoId).order("ordem").order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjetoEtapa[];
});



/** O usuário é da administração da plataforma? (public.eh_master) */
export const ehMaster = cache(async (): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("eh_master");
  // Falha aqui não é motivo para quebrar a tela: sem master, só não aparece o link.
  return !error && data === true;
});

/** Painel do master: uma linha por empresa, com contrato e uso. */
export const listarEmpresas = cache(async (): Promise<EmpresaPlataforma[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("empresas_da_plataforma");
  if (error) throw new Error(error.message);
  return (data ?? []) as EmpresaPlataforma[];
});

/** Panorama macro da plataforma (uma linha por moeda). */
export const obterPainelPlataforma = cache(async (): Promise<PainelPlataforma[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("painel_plataforma");
  if (error) throw new Error(error.message);
  return (data ?? []) as PainelPlataforma[];
});

/** Todas as faturas, para a tela agrupar por empresa sem uma consulta por ficha. */
export const listarFaturas = cache(async (): Promise<Fatura[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("faturas").select("*").order("vencimento", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Fatura[];
});

/**
 * O acesso está suspenso por contrato? A tela precisa saber para EXPLICAR:
 * sem isso, a suspensão aparece como lista vazia e o cliente pensa que perdeu
 * os dados.
 */
export const acessoSuspenso = cache(async (): Promise<boolean> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("meu_acesso_suspenso");
  return !error && data === true;
});

/** Clientes da empresa do usuário; vazio quando ele não tem organização. */
export const listarClientes = cache(async (organizacaoId?: string): Promise<Cliente[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("clientes").select("*")
    .eq("organizacao_id", organizacaoId).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Cliente[];
});

export const listarFornecedores = cache(async (organizacaoId?: string): Promise<Fornecedor[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("fornecedores").select("*")
    .eq("organizacao_id", organizacaoId).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Fornecedor[];
});

export const listarCommodities = cache(async (organizacaoId?: string): Promise<Commodity[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("commodities").select("*")
    .eq("organizacao_id", organizacaoId).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Commodity[];
});

/** Todos os parâmetros das commodities da empresa, para a tela agrupar sem N consultas. */
export const listarParametros = cache(async (commodityIds: string[]): Promise<CommodityParametro[]> => {
  if (commodityIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("commodity_parametros").select("*")
    .in("commodity_id", commodityIds).order("ordem").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as CommodityParametro[];
});

/** Painel consolidado da empresa (uma linha por moeda); vazio sem organização. */
export const obterPainelEmpresa = cache(async (organizacaoId?: string): Promise<PainelEmpresa[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("painel_empresa", { p_organizacao_id: organizacaoId });
  if (error) throw new Error(error.message);
  return (data ?? []) as PainelEmpresa[];
});

/** Contratos comerciais da empresa (0018), do mais recente para o mais antigo. */
export const listarContratos = cache(async (organizacaoId?: string): Promise<Contrato[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("contratos").select("*")
    .eq("organizacao_id", organizacaoId).order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contrato[];
});

export const obterContrato = cache(async (id: string): Promise<Contrato> => {
  if (!UUID.test(id)) notFound();
  const supabase = createClient();
  const { data, error } = await supabase.from("contratos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  // O RLS devolve vazio para contrato de outra empresa: para quem pergunta, ele não existe.
  if (!data) notFound();
  return data as Contrato;
});

/** Partes de todos os contratos da empresa, para as telas agruparem sem N consultas. */
export const listarPartes = cache(async (organizacaoId?: string): Promise<ContratoParte[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("contrato_partes").select("*").eq("organizacao_id", organizacaoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ContratoParte[];
});

export const listarInstrumentos = cache(async (organizacaoId?: string): Promise<Instrumento[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("instrumentos").select("*")
    .eq("organizacao_id", organizacaoId).order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Instrumento[];
});

export const listarMonetizacoes = cache(async (organizacaoId?: string): Promise<Monetizacao[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("monetizacoes").select("*")
    .eq("organizacao_id", organizacaoId).order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as Monetizacao[];
});

export const listarRemuneracoes = cache(async (organizacaoId?: string): Promise<RemuneracaoGestao[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("remuneracoes_gestao").select("*")
    .eq("organizacao_id", organizacaoId).order("criado_em");
  if (error) throw new Error(error.message);
  return (data ?? []) as RemuneracaoGestao[];
});

/** Soma dos aportes por projeto da empresa — base da taxa de administração. */
export const capitalPorProjeto = cache(async (projetoIds: string[]): Promise<Map<string, number>> => {
  const m = new Map<string, number>();
  if (projetoIds.length === 0) return m;
  const supabase = createClient();
  const { data, error } = await supabase.from("aportes").select("projeto_id, valor").in("projeto_id", projetoIds);
  if (error) throw new Error(error.message);
  for (const a of (data ?? []) as { projeto_id: string; valor: number }[]) {
    m.set(a.projeto_id, (m.get(a.projeto_id) ?? 0) + Number(a.valor));
  }
  return m;
});

/** Documentos dos clientes da empresa (0021), do mais novo para o mais antigo. */
export const listarDocumentosClientes = cache(async (organizacaoId?: string): Promise<ClienteDocumento[]> => {
  if (!organizacaoId) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("cliente_documentos").select("*")
    .eq("organizacao_id", organizacaoId).order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClienteDocumento[];
});
