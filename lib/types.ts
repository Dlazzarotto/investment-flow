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

export const CATEGORIAS_DESPESA = [
  "pessoal", "manutencao", "combustivel", "arrendamento", "administrativo", "impostos", "outros",
] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

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
  organizacao_id: string | null;
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
  /** E-mail do login do investidor; com ele, a pessoa entra como 'investidor' e vê só o que é dela. */
  email: string | null;
  email_normalizado: string | null;
  criado_em: string;
}

export const TIPOS_APORTE = ["dinheiro", "maquinario", "credito", "servico", "direito_minerario", "outro"] as const;
export type TipoAporte = (typeof TIPOS_APORTE)[number];

/** Como um participante entrou no projeto (tabela aportes, 0007). */
export interface Aporte {
  id: string;
  projeto_id: string;
  participante_id: string;
  tipo: TipoAporte;
  descricao: string;
  valor: number;
  data: string;
  observacoes: string | null;
  criado_em: string;
}

export interface Organizacao { id: string; nome: string; criado_por: string; criado_em: string }
export interface OrganizacaoMembro { id: string; organizacao_id: string; email: string; email_normalizado: string; criado_em: string }

/** Totais do projeto para qualquer membro (public.resumo_projeto). */
export interface ResumoProjeto {
  investimento_total: number;
  receita_total: number;
  custo_vendas_total: number;
  despesas_total: number;
  saida_total: number;
  saldo: number;
  aportes_total: number;
}

/** Linha de public.minha_carteira(): um projeto em que o usuário é participante. */
export interface CarteiraItem {
  projeto_id: string;
  nome: string;
  moeda: Moeda;
  tipo_parceria: TipoParceria;
  data_inicio: string;
  participante_id: string;
  participante_nome: string;
  minha_pct: number;
  meus_aportes: number;
  investimento_total: number;
  receita_total: number;
  saida_total: number;
  saldo: number;
  saldo_atribuivel: number;
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
  /** Custo da mercadoria por unidade de volume. */
  custo_unitario: number;
  /** Frete e logística por unidade de volume. */
  frete_unitario: number;
  /** Impostos e royalties, em % da receita. */
  impostos_pct: number;
  /** Comissões, em % da receita. */
  comissao_pct: number;
  /** Coluna gerada: soma dos quatro componentes acima. */
  custo_total: number;
  data: string;
  criado_em: string;
}

/** Despesa do projeto que não se liga a uma venda específica (custeio). */
export interface Despesa {
  id: string;
  projeto_id: string;
  descricao: string;
  categoria: CategoriaDespesa;
  valor: number;
  data: string;
  criado_em: string;
}

/** Linha devolvida por public.fluxo_mensal(uuid) */
export interface FluxoMensal {
  mes: string; // 'YYYY-MM-DD' (primeiro dia do mês)
  investimento: number;
  /** Custo direto das vendas do mês (vendas.custo_total). */
  custo_vendas: number;
  despesas: number;
  /** investimento + custo_vendas + despesas. */
  saida: number;
  receita: number;
  saida_acumulada: number;
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

/**
 * Papel de acesso de um membro convidado (tabela projeto_membros).
 *   admin      → tudo que o dono faz, menos excluir o projeto
 *   manager    → vê e lança entradas e saídas; não enxerga investimentos
 *   escritorio → só lança; alterar e excluir exigem o PIN do projeto
 */
export const PAPEIS_MEMBRO = ["admin", "manager", "escritorio", "investidor"] as const;
export type PapelMembro = (typeof PAPEIS_MEMBRO)[number];

/** Papel do usuário logado no projeto; null quando não tem acesso. */
export type PapelNoProjeto = PapelMembro | "dono" | null;

/** O que cada papel pode fazer — derivado em lib/permissoes.ts, espelha o SQL de 0006. */
export interface Permissoes {
  verInvestimentos: boolean;
  lancar: boolean;
  /** Altera e exclui sem precisar de PIN. */
  alterar: boolean;
  /** Pode alterar/excluir digitando o PIN do projeto (escritório). */
  alterarComPin: boolean;
  administrar: boolean;
  ehDono: boolean;
  /** Só lê o que é dele (própria participação e aportes); vive em /carteira. */
  ehInvestidor: boolean;
}

/** Convite por link (o token em si nunca volta do banco — só o hash fica guardado). */
export interface Convite {
  id: string;
  projeto_id: string;
  papel: PapelMembro;
  criado_em: string;
  expira_em: string;
  usos: number;
  max_usos: number;
  revogado: boolean;
}

export interface ProjetoMembro {
  id: string;
  projeto_id: string;
  email: string;
  email_normalizado: string;
  papel: PapelMembro;
  criado_em: string;
}

/** Modo da estimativa: produzir e vender, ou comprar e repassar. */
export const MODOS_ESTIMATIVA = ["producao_propria", "revenda"] as const;
export type ModoEstimativa = (typeof MODOS_ESTIMATIVA)[number];

export const GRUPOS_CUSTO = [
  "producao", "pessoal", "manutencao", "arrendamento", "logistica_interna", "porto", "frete",
  "tributos", "taxas_licencas", "administrativo", "outros",
] as const;
export type GrupoCusto = (typeof GRUPOS_CUSTO)[number];

/** Como o valor do item vira custo por unidade de produto (ver lib/custeio.ts). */
export const DRIVERS_CUSTO = [
  "por_unidade", "por_dia", "por_mes", "por_viagem", "por_lote", "pct_custo", "pct_receita",
] as const;
export type DriverCusto = (typeof DRIVERS_CUSTO)[number];

/** Custeio do projeto — um por projeto; nome e moeda vêm do próprio projeto. */
export interface EstimativaCusto {
  id: string;
  projeto_id: string;
  commodity: string;
  modo: ModoEstimativa;
  unidade: string;
  volume_total: number;
  producao_diaria: number;
  dias_mes: number;
  margem_alvo_pct: number;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export const MODAIS_ETAPA = [
  "extracao", "beneficiamento", "rodoviario", "ferroviario", "fluvial", "maritimo",
  "portuario", "armazenagem", "documentacao", "outro",
] as const;
export type ModalEtapa = (typeof MODAIS_ETAPA)[number];

/**
 * Etapa da cadeia logística do PROJETO (mina → porto → barcaça → porto final →
 * navio). A rota é do projeto; o custeio dele percorre sempre as mesmas etapas.
 */
export interface ProjetoEtapa {
  id: string;
  projeto_id: string;
  ordem: number;
  nome: string;
  modal: ModalEtapa;
  origem: string | null;
  destino: string | null;
  /** País da etapa — define a legislação usada na sugestão de salário. */
  pais: string | null;
  observacoes: string | null;
  criado_em: string;
}

export interface EstimativaItem {
  id: string;
  estimativa_id: string;
  /** Null para custo que não pertence a etapa nenhuma (administrativo, tributo). */
  etapa_id: string | null;
  grupo: GrupoCusto;
  nome: string;
  driver: DriverCusto;
  valor: number;
  quantidade: number;
  /** Toneladas por viagem; só o driver por_viagem usa. */
  capacidade: number | null;
  /** 'ia' marca o que o modelo sugeriu e ainda não foi confirmado por gente. */
  origem: "manual" | "ia";
  fonte: string | null;
  ordem: number;
  criado_em: string;
}
