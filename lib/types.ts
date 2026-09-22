/** Tipos de domínio — espelham os enums e tabelas de supabase/migrations/0001_schema.sql */

export const MOEDAS = ["USD", "BRL", "EUR", "GBP"] as const;
export type Moeda = (typeof MOEDAS)[number];

export const TIPOS_PARCERIA = ["sociedade_direta", "joint_venture", "investidor"] as const;
export type TipoParceria = (typeof TIPOS_PARCERIA)[number];

export const TIPOS_PARTICIPANTE = ["socio", "parceiro_jv", "investidor", "operador"] as const;
export type TipoParticipante = (typeof TIPOS_PARTICIPANTE)[number];

export const CATEGORIAS_INVESTIMENTO = ["infraestrutura", "logistica", "operacional"] as const;
export type CategoriaInvestimento = (typeof CATEGORIAS_INVESTIMENTO)[number];

export const CATEGORIAS_RECEITA = ["venda_produto", "frete_logistica", "servicos", "outros"] as const;
export type CategoriaReceita = (typeof CATEGORIAS_RECEITA)[number];

export const UNIDADES_VOLUME = ["Toneladas", "m³", "Barris", "Unidades", "Contêineres", "Horas"] as const;

export interface Projeto {
  id: string;
  owner_id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string; // ISO date
  moeda: Moeda;
  tipo_parceria: TipoParceria;
  participacao_pct: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Participante {
  id: string;
  projeto_id: string;
  nome: string;
  tipo: TipoParticipante;
  percentual: number;
  contato: string | null;
  criado_em: string;
}

export interface Investimento {
  id: string;
  projeto_id: string;
  item: string;
  categoria: CategoriaInvestimento;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  data: string;
  criado_em: string;
}

export interface Venda {
  id: string;
  projeto_id: string;
  categoria: CategoriaReceita;
  volume: number;
  unidade: string;
  preco_unitario: number;
  receita_total: number;
  data: string;
  criado_em: string;
}

/** Linha devolvida por public.fluxo_mensal(uuid) */
export interface FluxoMensal {
  mes: string; // 'YYYY-MM-DD' (primeiro dia do mês)
  investimento: number;
  receita: number;
  inv_acumulado: number;
  rec_acumulada: number;
  saldo_acumulado: number;
}

/** Estado devolvido pelas server actions para os formulários */
export type ActionState = { ok: boolean; erro?: string; sucesso?: string };

/** Estimativa de valor médio de mercado gerada por IA (tabela estimativas_ia) */
export type Confianca = "baixa" | "media" | "alta";

export interface FonteEstimativa { titulo: string; url: string }

export interface EstimativaIA {
  id: string;
  projeto_id: string;
  item: string;
  item_normalizado: string;
  contexto: string | null;
  moeda: Moeda;
  unidade_ref: string;
  valor_min: number;
  valor_medio: number;
  valor_max: number;
  confianca: Confianca;
  premissas: string[];
  fontes: FonteEstimativa[];
  modelo: string;
  criado_em: string;
}

/** Papel de acesso de um membro convidado (tabela projeto_membros). */
export const PAPEIS_MEMBRO = ["leitor", "editor"] as const;
export type PapelMembro = (typeof PAPEIS_MEMBRO)[number];

/** Papel do usuário logado no projeto; null quando não tem acesso. */
export type PapelNoProjeto = PapelMembro | "dono" | null;

export interface ProjetoMembro {
  id: string;
  projeto_id: string;
  email: string;
  email_normalizado: string;
  papel: PapelMembro;
  criado_em: string;
}
