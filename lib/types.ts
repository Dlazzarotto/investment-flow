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

export const UNIDADES_VOLUME = ["Toneladas", "m³", "Barris", "Onças troy", "MMBtu", "Unidades", "Contêineres", "Horas"] as const;

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

export interface Organizacao {
  id: string; nome: string; criado_por: string; criado_em: string;
  /** Teto de assentos do plano (0009); null = sem teto. Só o master altera. */
  assentos: number | null;
}
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

/** Linha de public.contratos_do_projeto() (0033): só números, sem partes nem número do contrato. */
export interface ContratoDoProjeto {
  id: string; data: string; direcao: "venda" | "compra"; volume: number; unidade: string; moeda: Moeda;
  preco: number; valor: number;
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
export type ActionState = { ok: boolean; erro?: string; sucesso?: string; /** Id do que foi criado, quando a tela precisa selecioná-lo. */ id?: string };

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
/**
 * Papéis que se DÃO por membro/convite. "investidor" existe no enum do banco, mas
 * investidor entra pelo e-mail em Participantes: por membro ele caía numa carteira
 * vazia (minha_carteira só lê participantes) e numa página inexistente.
 */
export const PAPEIS_CONVIDAVEIS = ["admin", "manager", "escritorio"] as const satisfies readonly PapelMembro[];

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
/** Situação da empresa cliente (0034). Só "ativa" tem acesso ao sistema; os dados das outras ficam guardados. */
export const SITUACOES_EMPRESA = ["ativa", "parada", "arquivada"] as const;
export type SituacaoEmpresa = (typeof SITUACOES_EMPRESA)[number];

export interface EmpresaPlataforma {
  id: string;
  nome: string;
  plano: PlanoEmpresa;
  /** null = sem teto de assentos. */
  assentos: number | null;
  ativa: boolean;
  /** 0034: ativa | parada | arquivada. `ativa` é espelho (ativa = situacao === "ativa"). */
  situacao: SituacaoEmpresa;
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
  /** Paradas ou com a vigência vencida — clientes a recuperar. Arquivadas ficam fora. */
  inativas: number;
  arquivadas: number;
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

/**
 * Grupo de commodity (0029). O padrão do mercado vem com `organizacao_id` vazio e
 * `codigo` (o rótulo sai de d.enums.grupoCommodity, nos 4 idiomas); o da empresa
 * vem com `nome`.
 */
export interface CommodityGrupo {
  id: string;
  organizacao_id: string | null;
  codigo: string | null;
  nome: string | null;
  ordem: number;
}

/** Grade de uma commodity (0029): "Fines 62% Fe", "GMO Grade 2". Tem especificação própria. */
export interface CommodityGrade {
  id: string;
  organizacao_id: string;
  commodity_id: string;
  nome: string;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
}

export const TIPOS_LOCAL = ["mina", "porto", "terminal_fluvial", "armazem", "ferrovia", "cidade", "outro"] as const;
export type TipoLocal = (typeof TIPOS_LOCAL)[number];

/** Local da empresa (0029): origem, ponto de carga/descarga, transbordo, destino final. */
export interface Local {
  id: string;
  organizacao_id: string;
  nome: string;
  tipo: TipoLocal;
  pais: string | null;
  regiao: string | null;
  unlocode: string | null;
  /** Calado máximo, em metros — limita o porte do navio. */
  calado_max_m: number | null;
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
}

export const EMBALAGENS = ["granel", "big_bag", "sacaria", "conteiner", "tambor", "isotanque", "outro"] as const;
export type Embalagem = (typeof EMBALAGENS)[number];
export const BASES_PRECO = ["mt", "wmt", "dmt", "dmtu", "bbl", "mmbtu", "lb", "oz", "bushel", "unidade"] as const;
export type BasePreco = (typeof BASES_PRECO)[number];
export const PORTES_NAVIO = [
  "handysize", "handymax", "supramax", "ultramax", "panamax", "kamsarmax", "post_panamax", "capesize", "vloc",
  "tanque_mr", "aframax", "suezmax", "vlcc", "conteineiro", "outro",
] as const;
export type PorteNavio = (typeof PORTES_NAVIO)[number];
export const LOCAIS_INSPECAO = ["carregamento", "descarga", "ambos"] as const;
export type LocalInspecao = (typeof LOCAIS_INSPECAO)[number];
export const PARTES_RESPONSAVEIS = ["vendedor", "comprador", "dividido"] as const;
export type ParteResponsavel = (typeof PARTES_RESPONSAVEIS)[number];
export const MODAIS_INTERIOR = ["caminhao", "ferrovia", "barcaca", "duto", "nenhuma"] as const;
export type ModalInterior = (typeof MODAIS_INTERIOR)[number];
/** Espelha contratos_documentos_ck (0029). */
export const DOCUMENTOS_EXIGIDOS = [
  "bl", "fatura_comercial", "packing_list", "certificado_origem", "certificado_qualidade", "certificado_peso",
  "draft_survey", "apolice_seguro", "fitossanitario", "nao_radioatividade", "certificado_fumigacao", "mates_receipt",
] as const;
export type DocumentoExigido = (typeof DOCUMENTOS_EXIGIDOS)[number];
/** Espelha a lista pronta de commodity_grupos (0029). */
export const GRUPOS_PADRAO = [
  "minerios", "metais_basicos", "metais_preciosos", "petroleo_derivados", "gas_natural", "carvao",
  "graos_oleaginosas", "softs", "fertilizantes", "quimicos", "proteinas", "florestais",
] as const;
export type GrupoPadrao = (typeof GRUPOS_PADRAO)[number];

/** Catálogo do mercado (0030), gerado da mesma fonte que a migration e os dicionários. */
export const COMMODITIES_PADRAO = [
  "iron_ore",
  "iron_ore_pellets",
  "manganese_ore",
  "chrome_ore",
  "copper_concentrate",
  "zinc_concentrate",
  "lead_concentrate",
  "bauxite",
  "spodumene",
  "copper_cathode",
  "aluminium",
  "zinc",
  "nickel",
  "lead",
  "tin",
  "pig_iron",
  "steel_billet",
  "gold",
  "silver",
  "platinum",
  "palladium",
  "crude_oil",
  "diesel_en590",
  "jet_a1",
  "gasoline",
  "fuel_oil",
  "naphtha",
  "lpg",
  "lng",
  "natural_gas",
  "thermal_coal",
  "coking_coal",
  "petcoke",
  "soybeans",
  "corn",
  "wheat",
  "soybean_meal",
  "soybean_oil",
  "rice",
  "sunflower_oil",
  "sugar_icumsa45",
  "sugar_vhp",
  "coffee_arabica",
  "coffee_robusta",
  "cocoa",
  "cotton",
  "orange_juice",
  "ethanol",
  "urea",
  "dap",
  "map",
  "potash",
  "ammonium_nitrate",
  "ammonia",
  "sulphur",
  "methanol",
  "caustic_soda",
  "sulphuric_acid",
  "polyethylene",
  "polypropylene",
  "beef",
  "chicken",
  "pork",
  "pulp_bekp",
  "pulp_nbsk",
  "timber",
  "wood_pellets",
] as const;
export type CommodityPadraoCodigo = (typeof COMMODITIES_PADRAO)[number];

/** Item do catálogo do mercado (0030): só leitura, igual para todas as empresas. */
export interface CommodityPadrao {
  codigo: CommodityPadraoCodigo;
  grupo_codigo: GrupoPadrao;
  unidade: string;
  referencia: string | null;
  ordem: number;
}

/** Pesquisa de mercado feita pelo agente (0031). Preço desconhecido é null, nunca zero. */
export interface PesquisaMercado {
  id: string;
  organizacao_id: string;
  commodity_id: string;
  grade_id: string | null;
  base: string | null;
  pergunta: string;
  idioma: "pt" | "en" | "es" | "zh";
  sessao_id: string | null;
  status: "pesquisando" | "concluida" | "falhou";
  resposta: string | null;
  erro: string | null;
  preco: number | null;
  moeda: string | null;
  unidade: string | null;
  base_cotacao: string | null;
  especificacao: string | null;
  data_cotacao: string | null;
  tipo: "spot" | "indice" | "futuro" | "oferta" | null;
  fonte: string | null;
  url: string | null;
  aproximacao: boolean | null;
  /** livre = pergunta da aba Commodities; bolsas = Xangai, Londres e Chicago do painel. */
  modo: "livre" | "bolsas";
  /** Só no modo bolsas: sempre três, na ordem Xangai, Londres, Chicago (extrairCotacoesBolsas). */
  cotacoes: import("./pesquisa").CotacaoBolsa[];
  custo_usd: number | null;
  criado_por: string | null;
  criado_em: string;
  concluida_em: string | null;
}

/** Catálogo de commodities da empresa (0015). */
export interface Commodity {
  id: string;
  organizacao_id: string;
  /** 0029: grupo padrão ou da empresa. `categoria` é o texto livre de antes. */
  grupo_id: string | null;
  /** 0030: de qual item do catálogo do mercado ela veio (null = criada pela empresa). */
  padrao_codigo: CommodityPadraoCodigo | null;
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
  /** 0029: com grade, é a especificação do grade; sem, é o padrão da commodity. */
  grade_id: string | null;
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
  /** Venda da 1ª versão de onde o contrato veio (0022). Com ela, os números ficam travados (0032). */
  venda_origem_id: string | null;
  numero: string | null;
  /** Obsoleto desde a 0019: as partes moram em contrato_partes. */
  contraparte_id: string | null;
  commodity_id: string;
  grade_id: string | null;
  especificacao: string | null;
  embalagem: Embalagem | null;
  base_preco: BasePreco | null;
  origem_id: string | null;
  ponto_carga_id: string | null;
  /** País ou região de destino. O porto é `ponto_descarga_id`. */
  destino: string | null;
  ponto_descarga_id: string | null;
  destino_final_id: string | null;
  transbordo_id: string | null;
  rota_fluvial: string | null;
  barcacas_qtd: number | null;
  barcaca_obs: string | null;
  porte_navio: PorteNavio | null;
  navio_nome: string | null;
  navio_imo: string | null;
  calado_max_m: number | null;
  /** Por unidade do contrato, na moeda do contrato. */
  frete_valor: number | null;
  taxa_carga_dia: number | null;
  taxa_descarga_dia: number | null;
  demurrage_dia: number | null;
  despatch_dia: number | null;
  entrega_interior: ModalInterior | null;
  entrega_interior_obs: string | null;
  inspetora: string | null;
  inspecao_local: LocalInspecao | null;
  inspecao_custo: ParteResponsavel | null;
  documentos_exigidos: DocumentoExigido[];
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
