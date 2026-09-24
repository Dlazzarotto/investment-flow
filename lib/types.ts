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
  /** 0022: em análise, em andamento, encerrado. */
  status: StatusProjeto;
  criado_em: string;
  atualizado_em: string;
}

export const STATUS_PROJETO = ["em_analise", "em_andamento", "encerrado"] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];

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

/**
 * Uma precificação do projeto. Há várias por projeto: o mesmo projeto vende para
 * clientes diferentes, cada um com seu lote, sua moeda e sua margem alvo.
 */
export interface EstimativaCusto {
  id: string;
  projeto_id: string;
  nome: string;
  commodity: string;
  /** Para quem é a proposta; opcional. */
  cliente: string | null;
  modo: ModoEstimativa;
  moeda: Moeda;
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

/** Faixas de licenciamento da plataforma (0009). */
export const PLANOS_EMPRESA = ["avaliacao", "boutique", "consolidada"] as const;
export type PlanoEmpresa = (typeof PLANOS_EMPRESA)[number];

/**
 * Uma empresa vista pelo master (public.empresas_da_plataforma()).
 * Traz CONTAGEM, nunca conteúdo: quantos projetos existem, não quais.
 */
export interface EmpresaPlataforma {
  id: string;
  nome: string;
  plano: PlanoEmpresa;
  /** null = sem teto de assentos. */
  assentos: number | null;
  ativa: boolean;
  vigencia_ate: string | null;
  /** ativa e dentro da vigência. */
  em_dia: boolean;
  /** Tem fatura vencida e em aberto. */
  em_debito: boolean;
  assentos_usados: number;
  projetos: number;
  admins: string[];
  mensalidade: number;
  setup: number;
  moeda_cobranca: Moeda;
  dia_vencimento: number;
  /** Soma das faturas em aberto, vencidas ou não. */
  aberto: number;
  /** A parte de `aberto` que já venceu. */
  atrasado: number;
  proximo_vencimento: string | null;
  criado_em: string;
}

export const TIPOS_FATURA = ["mensalidade", "setup", "outro"] as const;
export type TipoFatura = (typeof TIPOS_FATURA)[number];

/** Uma cobrança da plataforma a uma empresa (0011). */
export interface Fatura {
  id: string;
  organizacao_id: string;
  tipo: TipoFatura;
  /** Mês de referência, sempre no dia 1 (trigger do banco). */
  competencia: string;
  descricao: string | null;
  valor: number;
  moeda: Moeda;
  vencimento: string;
  /** null = em aberto. */
  pago_em: string | null;
  criado_em: string;
}

/**
 * Panorama macro da plataforma, UMA LINHA POR MOEDA — somar BRL com USD num
 * número só daria um valor que não existe. As contagens repetem em toda linha.
 */
export interface PainelPlataforma {
  moeda: Moeda;
  ativas: number;
  inativas: number;
  em_debito: number;
  contrato_mensal: number;
  a_receber: number;
  em_atraso: number;
  recebido_mes: number;
}

/**
 * Cadastros comerciais da EMPRESA (0014). São da organização e não do projeto:
 * o mesmo comprador aparece em vários embarques, e repetir o cadastro por
 * projeto seria garantir que os dados divergem.
 */
export const TIPOS_CLIENTE = ["investidor", "comprador", "vendedor", "monetizador", "financial_partner"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export interface Cliente {
  id: string;
  organizacao_id: string;
  nome: string;
  /** Um cliente pode ser mais de uma coisa — quem compra também investe. */
  tipos: TipoCliente[];
  documento: string | null;
  email: string | null;
  telefone: string | null;
  pais: string | null;
  endereco: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Fornecedor {
  id: string;
  organizacao_id: string;
  nome: string;
  /** O que fornece, no mesmo vocabulário do custeio. */
  servico: GrupoCusto;
  /** Só para quem transporta; null nos demais. */
  modal: ModalEtapa | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  pais: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

/** Catálogo de commodities da empresa (0015). */
export interface Commodity {
  id: string;
  organizacao_id: string;
  nome: string;
  categoria: string | null;
  unidade_padrao: string;
  /** Onde se olha o preço: "SGX TSI 62% Fe", "CBOT Soybeans". */
  bolsa: string | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Um parâmetro de qualidade: Fe, umidade, sílica. `ajuste_por_ponto` é a ponte
 * entre qualidade e preço — positivo para o que valoriza, negativo para o que
 * penaliza.
 */
export interface CommodityParametro {
  id: string;
  commodity_id: string;
  nome: string;
  unidade: string;
  /** Teor que o índice de mercado assume (62 no "62% Fe"). */
  referencia: number | null;
  minimo: number | null;
  maximo: number | null;
  ajuste_por_ponto: number;
  ordem: number;
  criado_em: string;
}

/**
 * Painel da empresa — o dashboard do ADM (0016). Uma linha POR MOEDA: projeto
 * em USD e projeto em BRL somados no mesmo widget dariam um número inexistente.
 * As contagens repetem em toda linha.
 */
export interface PainelEmpresa {
  moeda: Moeda;
  clientes: number;
  clientes_ativos: number;
  fornecedores: number;
  commodities: number;
  projetos: number;
  investimento: number;
  receita: number;
  custo_vendas: number;
  despesas: number;
  /** investimento + custo_vendas + despesas (regra das três saídas). */
  saida: number;
  saldo: number;
  receita_mes: number;
  vendas_qtd: number;
}

// ---------------------------------------------------------------------------
// Contratos comerciais (0018) — o centro da operação de trading
// ---------------------------------------------------------------------------
export const DIRECOES_CONTRATO = ["venda", "compra"] as const;
export type DirecaoContrato = (typeof DIRECOES_CONTRATO)[number];
/** Principal = trader (compra e revende, dono da carga); agente = intermedia e ganha comissão. */
export const PAPEIS_CONTRATO = ["principal", "agente"] as const;
export type PapelContrato = (typeof PAPEIS_CONTRATO)[number];
export const MODALIDADES_CONTRATO = ["spot", "term"] as const;
export type ModalidadeContrato = (typeof MODALIDADES_CONTRATO)[number];
export const TIPOS_PRECO = ["fixo", "formula"] as const;
export type TipoPreco = (typeof TIPOS_PRECO)[number];
/**
 * Momento em que vence o saldo (0020). Carta de crédito NÃO é forma de pagamento:
 * é garantia e mora em `instrumentos`. Venda FOB dentro do país paga no
 * carregamento do caminhão — não há BL.
 */
export const EVENTOS_SALDO = ["carregamento", "bl", "documentos", "descarga"] as const;
export type EventoSaldo = (typeof EVENTOS_SALDO)[number];
export const STATUS_CONTRATO = ["rascunho", "assinado", "em_execucao", "concluido", "cancelado"] as const;
export type StatusContrato = (typeof STATUS_CONTRATO)[number];
/** Incoterms 2020 — códigos iguais em todos os idiomas, por isso não vão para os dicionários. */
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];
export const BASES_COMISSAO = ["por_unidade", "pct_valor"] as const;
export type BaseComissao = (typeof BASES_COMISSAO)[number];

export interface Contrato {
  id: string;
  organizacao_id: string;
  numero: string | null;
  /** Obsoleto desde a 0019: as partes moram em contrato_partes. */
  contraparte_id: string | null;
  commodity_id: string;
  projeto_id: string | null;
  conta: ContaContrato;
  assinante: AssinanteContrato;
  estimativa_id: string | null;
  direcao: DirecaoContrato;
  papel: PapelContrato;
  modalidade: ModalidadeContrato;
  status: StatusContrato;
  volume: number;
  tolerancia_pct: number;
  unidade: string;
  incoterm: Incoterm;
  porto_embarque: string | null;
  porto_destino: string | null;
  moeda: Moeda;
  tipo_preco: TipoPreco;
  preco_fixo: number | null;
  indice: string | null;
  premio: number;
  periodo_cotacao: string | null;
  indice_referencia: number | null;
  /** % pago antes do embarque; o saldo vence no `evento_saldo` + `prazo_pagamento_dias`. */
  pct_antecipado: number;
  evento_saldo: EventoSaldo;
  prazo_pagamento_dias: number;
  pct_provisoria: number | null;
  comissao_base: BaseComissao | null;
  comissao_valor: number | null;
  data_loi: string | null;
  data_icpo: string | null;
  data_sco: string | null;
  data_assinatura: string | null;
  inicio_entregas: string | null;
  fim_entregas: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

// ---------------------------------------------------------------------------
// 0019 — partes, instrumentos bancários, monetização e remuneração da gestão
// ---------------------------------------------------------------------------
/** O Financial Partner recebe e administra o instrumento; não responde pelo produto. */
export const PAPEIS_PARTE = ["comprador", "vendedor", "financial_partner"] as const;
export type PapelParte = (typeof PAPEIS_PARTE)[number];
/** Por conta de quem: o resultado segue a conta. */
export const CONTAS_CONTRATO = ["propria", "projeto"] as const;
export type ContaContrato = (typeof CONTAS_CONTRATO)[number];
/** Quem assina: informação jurídica, não muda o resultado. */
export const ASSINANTES_CONTRATO = ["empresa", "projeto"] as const;
export type AssinanteContrato = (typeof ASSINANTES_CONTRATO)[number];
export const TIPOS_INSTRUMENTO = ["dlc", "sblc", "lc"] as const;
export type TipoInstrumento = (typeof TIPOS_INSTRUMENTO)[number];
export const STATUS_INSTRUMENTO = ["solicitado", "emitido", "recebido", "monetizado", "liquidado", "vencido", "cancelado"] as const;
export type StatusInstrumento = (typeof STATUS_INSTRUMENTO)[number];
export const STATUS_MONETIZACAO = ["negociacao", "aprovada", "paga", "cancelada"] as const;
export type StatusMonetizacao = (typeof STATUS_MONETIZACAO)[number];
export const TIPOS_REMUNERACAO = ["taxa_adm_anual_pct", "fixo_mensal", "pct_vendas", "por_unidade", "performance_pct"] as const;
export type TipoRemuneracao = (typeof TIPOS_REMUNERACAO)[number];

export interface ContratoParte {
  id: string;
  organizacao_id: string;
  contrato_id: string;
  cliente_id: string;
  papel: PapelParte;
  criado_em: string;
}

export interface Instrumento {
  id: string;
  organizacao_id: string;
  contrato_id: string;
  tipo: TipoInstrumento;
  financial_partner_id: string | null;
  banco_emissor: string | null;
  numero: string | null;
  valor_face: number;
  moeda: Moeda;
  data_emissao: string | null;
  validade: string | null;
  prazo_apresentacao: string | null;
  status: StatusInstrumento;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Monetizacao {
  id: string;
  organizacao_id: string;
  numero: string | null;
  instrumento_id: string;
  financial_partner_id: string;
  beneficiario_id: string | null;
  projeto_id: string | null;
  /** % do valor de FACE que o Financial Partner paga. */
  pct_monetizacao: number;
  /** % do valor MONETIZADO que a empresa ganha. */
  comissao_pct: number;
  status: StatusMonetizacao;
  data_oferta: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RemuneracaoGestao {
  id: string;
  organizacao_id: string;
  projeto_id: string;
  tipo: TipoRemuneracao;
  valor: number;
  inicio: string | null;
  fim: string | null;
  observacoes: string | null;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// 0021 — documentos do cliente
// ---------------------------------------------------------------------------
export const TIPOS_DOCUMENTO_CLIENTE = ["cis", "loi", "icpo", "kyc", "contrato_social", "procuracao", "outro"] as const;
export type TipoDocumentoCliente = (typeof TIPOS_DOCUMENTO_CLIENTE)[number];

export interface ClienteDocumento {
  id: string;
  organizacao_id: string;
  cliente_id: string;
  tipo: TipoDocumentoCliente;
  nome_arquivo: string;
  /** Caminho no bucket "documentos"; a 1ª pasta é a empresa. */
  caminho: string;
  tamanho: number | null;
  mime: string | null;
  emitido_em: string | null;
  validade: string | null;
  observacoes: string | null;
  enviado_por: string | null;
  criado_em: string;
}
