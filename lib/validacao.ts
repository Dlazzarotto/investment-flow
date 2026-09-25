/** Esquemas zod com mensagens no idioma do usuário (usados pelas server actions). */
import { z } from "zod";
import { fmtTexto, type Dicionario } from "./i18n";
import {
  CATEGORIAS_DESPESA, CATEGORIAS_INVESTIMENTO, CATEGORIAS_RECEITA, MOEDAS, PAPEIS_MEMBRO,
  DRIVERS_CUSTO, GRUPOS_CUSTO, MODAIS_ETAPA, MODOS_ESTIMATIVA, PLANOS_EMPRESA, TIPOS_APORTE, TIPOS_CLIENTE, TIPOS_FATURA, TIPOS_PARCERIA, TIPOS_PARTICIPANTE,
  STATUS_PROJETO, TIPOS_DOCUMENTO_CLIENTE, ASSINANTES_CONTRATO, CONTAS_CONTRATO, STATUS_INSTRUMENTO, STATUS_MONETIZACAO, TIPOS_INSTRUMENTO, TIPOS_REMUNERACAO,
  BASES_COMISSAO, DIRECOES_CONTRATO, EVENTOS_SALDO, INCOTERMS, MODALIDADES_CONTRATO, PAPEIS_CONTRATO, STATUS_CONTRATO, TIPOS_PRECO,
} from "./types";

/** Limites das colunas do banco: numeric(14,3) para quantidade/volume e numeric(16,2) para valores. */
const MAX_QUANTIDADE = 1e11;
const MAX_VALOR = 1e14;

/** "AAAA-MM-DD" que existe de fato no calendário (o Date do V8 aceitaria 2026-02-30 como 2 de março). */
export function ehDataISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export function criarSchemas(d: Dicionario) {
  const v = d.validacao;
  const dataISO = z.string().refine(ehDataISO, v.dataInvalida);
  const numeroPositivo = (campo: string, max: number) =>
    z.coerce.number({ invalid_type_error: fmtTexto(v.numero, { campo }) })
      .finite(fmtTexto(v.valorAlto, { campo }))
      .gt(0, fmtTexto(v.maiorZero, { campo }))
      .lt(max, fmtTexto(v.valorAlto, { campo }));
  const percentual = z.coerce.number({ invalid_type_error: v.pctNumero }).min(0, v.pctNegativo).max(100, v.pctMax);
  /** Custo opcional: zero é válido (venda sem custo lançado), negativo não. */
  const custoOpcional = (campo: string) =>
    z.coerce.number({ invalid_type_error: fmtTexto(v.numero, { campo }) })
      .finite(fmtTexto(v.valorAlto, { campo }))
      .min(0, fmtTexto(v.numero, { campo }))
      .lt(MAX_VALOR, fmtTexto(v.valorAlto, { campo }))
      .catch(0);
  const enumMsg = (msg: string) => ({ errorMap: () => ({ message: msg }) });
  const uuid = z.string().uuid(v.idInvalido);
  /** Campo de texto opcional: vazio vira null em vez de string em branco. */
  const textoOpcional = (max: number) =>
    z.string().trim().max(max, v.nomeLongo).optional().transform((x) => x || null);
  /** Número opcional: campo em branco vira null, não zero — "não informado" não é "zero". */
  const numeroOpcional = () =>
    z.union([z.literal(""), z.coerce.number().finite()]).optional()
      .transform((x) => (typeof x === "number" ? x : null));

  return {
    projeto: z.object({
      nome: z.string().trim().min(1, v.nomeProjeto).max(120, v.nomeLongo),
      descricao: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
      data_inicio: dataISO,
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      // 0022: a empresa ADMINISTRA o projeto; tipo de parceria saiu da tela e a
      // participação da empresa nasce 0 % (se ela também for sócia, informa aqui).
      tipo_parceria: z.enum(TIPOS_PARCERIA, enumMsg(v.tipoParceriaInvalido)).optional(),
      // Vazio/ausente = 0 %; fora de 0–100 continua ERRO (catch engoliria um 101 e gravaria 0).
      participacao_pct: z.union([z.undefined(), z.literal("").transform(() => 0), percentual]).transform((x) => x ?? 0),
      status: z.enum(STATUS_PROJETO, enumMsg(v.dadosInvalidos)).catch("em_andamento"),
    }),
    statusProjeto: z.object({ id: uuid, status: z.enum(STATUS_PROJETO, enumMsg(v.dadosInvalidos)) }),
    participante: z.object({
      projeto_id: uuid,
      nome: z.string().trim().min(1, v.nomeParticipante).max(120, v.nomeLongo),
      tipo: z.enum(TIPOS_PARTICIPANTE, enumMsg(v.tipoParticipanteInvalido)),
      percentual: percentual.gt(0, v.pctMaiorZero),
      contato: z.string().trim().max(200, v.contatoLongo).optional().transform((x) => x || null),
      // E-mail do login do investidor (0007): opcional; vazio vira null.
      email: z.string().trim().max(320, v.nomeLongo).optional().transform((x) => x || null)
        .refine((x) => x === null || z.string().email().safeParse(x).success, v.emailInvalido),
    }),
    aporte: z.object({
      projeto_id: uuid,
      participante_id: z.string().uuid(v.participanteObrigatorio),
      tipo: z.enum(TIPOS_APORTE, enumMsg(v.tipoAporteInvalido)),
      descricao: z.string().trim().min(1, v.descricaoObrigatoria).max(200, v.nomeLongo),
      valor: numeroPositivo(v.valor, MAX_VALOR),
      data: dataISO,
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
    }),
    organizacaoMembro: z.object({
      organizacao_id: uuid,
      email: z.string().trim().email(v.emailInvalido).max(320, v.nomeLongo),
    }),
    investimento: z.object({
      projeto_id: uuid,
      item: z.string().trim().min(1, v.itemObrigatorio).max(160, v.nomeLongo),
      categoria: z.enum(CATEGORIAS_INVESTIMENTO, enumMsg(v.categoriaInvalida)),
      quantidade: numeroPositivo(v.quantidade, MAX_QUANTIDADE),
      valor_unitario: numeroPositivo(v.valorUnitario, MAX_VALOR),
      data: dataISO,
    }),
    venda: z.object({
      projeto_id: uuid,
      categoria: z.enum(CATEGORIAS_RECEITA, enumMsg(v.categoriaInvalida)),
      volume: numeroPositivo(v.volume, MAX_QUANTIDADE),
      unidade: z.string().trim().min(1, v.unidadeObrigatoria).max(40, v.unidadeLonga),
      preco_unitario: numeroPositivo(v.precoUnitario, MAX_VALOR),
      // Custos são opcionais: campo em branco vira 0 e a venda fica como antes de 0005.
      custo_unitario: custoOpcional(v.custoUnitario2),
      frete_unitario: custoOpcional(v.freteUnitario),
      impostos_pct: percentual.catch(0),
      comissao_pct: percentual.catch(0),
      data: dataISO,
    }),
    despesa: z.object({
      projeto_id: uuid,
      descricao: z.string().trim().min(1, v.descricaoObrigatoria).max(160, v.nomeLongo),
      categoria: z.enum(CATEGORIAS_DESPESA, enumMsg(v.categoriaInvalida)),
      valor: numeroPositivo(v.valorDespesa, MAX_VALOR),
      data: dataISO,
    }),
    membro: z.object({
      projeto_id: uuid,
      email: z.string().trim().toLowerCase().email(v.emailInvalido).max(320, v.nomeLongo),
      papel: z.enum(PAPEIS_MEMBRO, enumMsg(v.papelInvalido)),
    }),
    convite: z.object({
      projeto_id: uuid,
      papel: z.enum(PAPEIS_MEMBRO, enumMsg(v.papelInvalido)),
      dias: z.coerce.number().int().min(1).max(90).catch(7),
      max_usos: z.coerce.number().int().min(1).max(50).catch(1),
    }),
    estimativa: z.object({
      projeto_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      commodity: z.string().trim().min(1, v.commodityObrigatorio).max(120, v.nomeLongo),
      cliente: z.string().trim().max(160, v.nomeLongo).optional().transform((x) => x || null),
      modo: z.enum(MODOS_ESTIMATIVA, enumMsg(v.modoInvalido)),
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      unidade: z.string().trim().min(1, v.unidadeObrigatoria).max(40, v.unidadeLonga),
      volume_total: numeroPositivo(v.volume, MAX_QUANTIDADE),
      producao_diaria: custoOpcional(v.producaoDiaria),
      dias_mes: z.coerce.number().int().min(1).max(31).catch(30),
      // 100 % de margem seria preço infinito — o limite é aberto de propósito.
      margem_alvo_pct: z.coerce.number({ invalid_type_error: v.pctNumero })
        .min(0, v.pctNegativo).max(99.99, v.margemMax).catch(0),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
    }),
    estimativaItem: z.object({
      estimativa_id: uuid,
      grupo: z.enum(GRUPOS_CUSTO, enumMsg(v.grupoInvalido)),
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      driver: z.enum(DRIVERS_CUSTO, enumMsg(v.driverInvalido)),
      valor: custoOpcional(v.valorDespesa),
      quantidade: numeroPositivo(v.quantidade, MAX_QUANTIDADE),
      capacidade: z.union([z.literal(""), z.coerce.number().positive().lt(MAX_QUANTIDADE)])
        .optional().transform((x) => (typeof x === "number" ? x : null)),
      origem: z.enum(["manual", "ia"]).catch("manual"),
      fonte: z.string().trim().max(500).optional().transform((x) => x || null),
    }).superRefine((i, ctx) => {
      // O banco repete essas duas travas; aqui a mensagem sai traduzida.
      if ((i.driver === "pct_custo" || i.driver === "pct_receita") && i.valor > 100) {
        ctx.addIssue({ code: "custom", path: ["valor"], message: v.pctMax });
      }
      if (i.driver === "por_viagem" && i.capacidade === null) {
        ctx.addIssue({ code: "custom", path: ["capacidade"], message: v.capacidadeObrigatoria });
      }
    }),
    etapa: z.object({
      projeto_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      modal: z.enum(MODAIS_ETAPA, enumMsg(v.modalInvalido)),
      origem: z.string().trim().max(160, v.nomeLongo).optional().transform((x) => x || null),
      destino: z.string().trim().max(160, v.nomeLongo).optional().transform((x) => x || null),
      pais: z.string().trim().max(80, v.nomeLongo).optional().transform((x) => x || null),
      ordem: z.coerce.number().int().min(0).max(999).catch(0),
      observacoes: z.string().trim().max(1000, v.descricaoLonga).optional().transform((x) => x || null),
    }),
    cliente: z.object({
      organizacao_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      // Vem de checkboxes, então chega como lista; nenhum tipo marcado é válido.
      tipos: z.array(z.enum(TIPOS_CLIENTE, enumMsg(v.tipoClienteInvalido))).default([]),
      documento: textoOpcional(40),
      email: z.string().trim().max(320, v.nomeLongo).optional().transform((x) => x || null)
        .refine((x) => x === null || z.string().email().safeParse(x).success, v.emailInvalido),
      telefone: textoOpcional(40),
      pais: textoOpcional(80),
      endereco: textoOpcional(300),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
      ativo: z.union([z.literal("on"), z.literal("")]).optional().transform((x) => x === "on"),
    }),
    fornecedor: z.object({
      organizacao_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      servico: z.enum(GRUPOS_CUSTO, enumMsg(v.grupoInvalido)),
      // Vazio = não transporta; o modal só faz sentido para quem leva carga.
      modal: z.union([z.literal(""), z.enum(MODAIS_ETAPA)]).optional()
        .transform((x) => (x ? x : null)),
      documento: textoOpcional(40),
      email: z.string().trim().max(320, v.nomeLongo).optional().transform((x) => x || null)
        .refine((x) => x === null || z.string().email().safeParse(x).success, v.emailInvalido),
      telefone: textoOpcional(40),
      pais: textoOpcional(80),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
      ativo: z.union([z.literal("on"), z.literal("")]).optional().transform((x) => x === "on"),
    }),
    commodity: z.object({
      organizacao_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(160, v.nomeLongo),
      categoria: textoOpcional(80),
      unidade_padrao: z.string().trim().min(1, v.unidadeObrigatoria).max(40, v.unidadeLonga),
      bolsa: textoOpcional(160),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
      ativo: z.union([z.literal("on"), z.literal("")]).optional().transform((x) => x === "on"),
    }),
    parametro: z.object({
      commodity_id: uuid,
      nome: z.string().trim().min(1, v.nomeObrigatorio).max(80, v.nomeLongo),
      unidade: z.string().trim().min(1, v.unidadeObrigatoria).max(20, v.unidadeLonga),
      referencia: numeroOpcional(),
      minimo: numeroOpcional(),
      maximo: numeroOpcional(),
      // Pode ser negativo: sílica e umidade DERRUBAM o preço.
      ajuste_por_ponto: z.coerce.number({ invalid_type_error: v.pctNumero }).finite().catch(0),
      ordem: z.coerce.number().int().min(0).max(999).catch(0),
    }).superRefine((x, ctx) => {
      if (x.minimo !== null && x.maximo !== null && x.minimo > x.maximo) {
        ctx.addIssue({ code: "custom", path: ["minimo"], message: v.faixaInvertida });
      }
    }),
    empresa: z.object({
      nome: z.string().trim().min(1, v.nomeOrganizacao).max(120, v.nomeLongo),
      email_adm: z.string().trim().toLowerCase().email(v.emailInvalido).max(320, v.nomeLongo),
      plano: z.enum(PLANOS_EMPRESA, enumMsg(v.planoInvalido)),
      // Vazio = sem teto de assentos, que é a faixa consolidada.
      assentos: z.union([z.literal(""), z.coerce.number().int().min(1).max(10_000)])
        .optional().transform((x) => (typeof x === "number" ? x : null)),
      vigencia_ate: z.union([z.literal(""), z.string().refine(ehDataISO, v.dataInvalida)])
        .optional().transform((x) => x || null),
    }),
    fatura: z.object({
      organizacao_id: uuid,
      tipo: z.enum(TIPOS_FATURA, enumMsg(v.tipoFaturaInvalido)),
      competencia: dataISO,
      descricao: z.string().trim().max(200, v.nomeLongo).optional().transform((x) => x || null),
      valor: numeroPositivo(v.valor, MAX_VALOR),
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      vencimento: dataISO,
    }),
    contrato: z.object({
      id: uuid,
      plano: z.enum(PLANOS_EMPRESA, enumMsg(v.planoInvalido)),
      mensalidade: custoOpcional(v.mensalidade),
      setup: custoOpcional(v.setup),
      moeda_cobranca: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      dia_vencimento: z.coerce.number().int().min(1).max(28).catch(10),
      assentos: z.union([z.literal(""), z.coerce.number().int().min(1).max(10_000)])
        .optional().transform((x) => (typeof x === "number" ? x : null)),
      ativa: z.union([z.literal("on"), z.literal("")]).optional().transform((x) => x === "on"),
      vigencia_ate: z.union([z.literal(""), z.string().refine(ehDataISO, v.dataInvalida)])
        .optional().transform((x) => x || null),
    }),
    /** Contrato comercial (0018). As travas do banco se repetem aqui para a mensagem sair traduzida. */
    contratoComercial: z.object({
      organizacao_id: uuid,
      numero: textoOpcional(60),
      // As partes vão para contrato_partes (0019); quais são obrigatórias depende do papel da empresa.
      comprador_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      vendedor_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      financial_partner_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      conta: z.enum(CONTAS_CONTRATO, enumMsg(v.dadosInvalidos)).catch("propria"),
      assinante: z.enum(ASSINANTES_CONTRATO, enumMsg(v.dadosInvalidos)).catch("empresa"),
      commodity_id: z.string().uuid(v.commodityObrigatorio),
      projeto_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      estimativa_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      direcao: z.enum(DIRECOES_CONTRATO, enumMsg(v.dadosInvalidos)),
      papel: z.enum(PAPEIS_CONTRATO, enumMsg(v.dadosInvalidos)),
      modalidade: z.enum(MODALIDADES_CONTRATO, enumMsg(v.dadosInvalidos)),
      status: z.enum(STATUS_CONTRATO, enumMsg(v.dadosInvalidos)),
      volume: numeroPositivo(v.volume, MAX_QUANTIDADE),
      tolerancia_pct: z.coerce.number({ invalid_type_error: v.pctNumero }).min(0, v.pctNegativo).max(50, v.toleranciaMax).catch(0),
      unidade: z.string().trim().min(1, v.unidadeObrigatoria).max(40, v.unidadeLonga),
      incoterm: z.enum(INCOTERMS, enumMsg(v.dadosInvalidos)),
      porto_embarque: textoOpcional(160),
      porto_destino: textoOpcional(160),
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      tipo_preco: z.enum(TIPOS_PRECO, enumMsg(v.dadosInvalidos)),
      preco_fixo: numeroOpcional(),
      indice: textoOpcional(160),
      // Prêmio pode ser negativo (desconto sobre o índice); vazio = zero.
      premio: z.union([z.literal(""), z.coerce.number().finite()]).optional()
        .transform((x) => (typeof x === "number" ? x : 0)),
      periodo_cotacao: textoOpcional(160),
      indice_referencia: numeroOpcional(),
      pct_antecipado: z.coerce.number({ invalid_type_error: v.pctNumero }).min(0, v.pctNegativo).max(100, v.pctMax).catch(0),
      evento_saldo: z.enum(EVENTOS_SALDO, enumMsg(v.dadosInvalidos)).catch("bl"),
      prazo_pagamento_dias: z.coerce.number().int().min(0).max(365).catch(0),
      pct_provisoria: numeroOpcional(),
      comissao_base: z.union([z.literal(""), z.enum(BASES_COMISSAO)]).optional().transform((x) => x || null),
      comissao_valor: numeroOpcional(),
      data_loi: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      data_icpo: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      data_sco: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      data_assinatura: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      inicio_entregas: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      fim_entregas: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
    }).superRefine((c, ctx) => {
      // Trader vendendo: a empresa é o vendedor, falta o comprador. Comprando: o
      // contrário. Intermediando: as duas pontas são clientes.
      const precisaComprador = c.papel === "agente" || c.direcao === "venda";
      const precisaVendedor = c.papel === "agente" || c.direcao === "compra";
      if (precisaComprador && !c.comprador_id) ctx.addIssue({ code: "custom", path: ["comprador_id"], message: v.compradorObrigatorio });
      if (precisaVendedor && !c.vendedor_id) ctx.addIssue({ code: "custom", path: ["vendedor_id"], message: v.vendedorObrigatorio });
      if (c.comprador_id && c.comprador_id === c.vendedor_id) {
        ctx.addIssue({ code: "custom", path: ["vendedor_id"], message: v.partesIguais });
      }
      if ((c.conta === "projeto" || c.assinante === "projeto") && !c.projeto_id) {
        ctx.addIssue({ code: "custom", path: ["projeto_id"], message: v.projetoObrigatorio });
      }
      if (c.tipo_preco === "fixo" && !(c.preco_fixo !== null && c.preco_fixo > 0)) {
        ctx.addIssue({ code: "custom", path: ["preco_fixo"], message: v.precoFixoObrigatorio });
      }
      if (c.tipo_preco === "formula" && c.indice === null) {
        ctx.addIssue({ code: "custom", path: ["indice"], message: v.indiceObrigatorio });
      }
      if (c.indice_referencia !== null && c.indice_referencia <= 0) {
        ctx.addIssue({ code: "custom", path: ["indice_referencia"], message: fmtTexto(v.maiorZero, { campo: v.indiceReferencia }) });
      }
      if (c.pct_provisoria !== null && !(c.pct_provisoria > 0 && c.pct_provisoria < 100)) {
        ctx.addIssue({ code: "custom", path: ["pct_provisoria"], message: v.provisoriaFaixa });
      }
      if (c.papel === "agente") {
        if (c.comissao_base === null || c.comissao_valor === null || c.comissao_valor <= 0) {
          ctx.addIssue({ code: "custom", path: ["comissao_valor"], message: v.comissaoObrigatoria });
        } else if (c.comissao_base === "pct_valor" && c.comissao_valor > 100) {
          ctx.addIssue({ code: "custom", path: ["comissao_valor"], message: v.pctMax });
        }
      }
      if (c.inicio_entregas && c.fim_entregas && c.fim_entregas < c.inicio_entregas) {
        ctx.addIssue({ code: "custom", path: ["fim_entregas"], message: v.periodoInvertido });
      }
    }).transform((c) => ({
      ...c,
      // O banco exige coerência: o campo do outro tipo de preço/papel vai nulo,
      // em vez de guardar um valor que ninguém vê na tela e que confundiria depois.
      preco_fixo: c.tipo_preco === "fixo" ? c.preco_fixo : null,
      indice: c.tipo_preco === "formula" ? c.indice : null,
      premio: c.tipo_preco === "formula" ? c.premio : 0,
      periodo_cotacao: c.tipo_preco === "formula" ? c.periodo_cotacao : null,
      indice_referencia: c.tipo_preco === "formula" ? c.indice_referencia : null,
      comissao_base: c.papel === "agente" ? c.comissao_base : null,
      comissao_valor: c.papel === "agente" ? c.comissao_valor : null,
      // Parte que não cabe no papel escolhido não é gravada (ex.: trader vendendo não tem vendedor-cliente).
      comprador_id: c.papel === "agente" || c.direcao === "venda" ? c.comprador_id : null,
      vendedor_id: c.papel === "agente" || c.direcao === "compra" ? c.vendedor_id : null,
    })),
    instrumento: z.object({
      organizacao_id: uuid,
      contrato_id: uuid,
      tipo: z.enum(TIPOS_INSTRUMENTO, enumMsg(v.dadosInvalidos)),
      financial_partner_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      banco_emissor: textoOpcional(160),
      numero: textoOpcional(80),
      valor_face: numeroPositivo(v.valorFace, MAX_VALOR),
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      data_emissao: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      validade: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      prazo_apresentacao: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      status: z.enum(STATUS_INSTRUMENTO, enumMsg(v.dadosInvalidos)).catch("solicitado"),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
    }).superRefine((i, ctx) => {
      if (i.data_emissao && i.validade && i.validade < i.data_emissao) {
        ctx.addIssue({ code: "custom", path: ["validade"], message: v.periodoInvertido });
      }
    }),
    monetizacao: z.object({
      organizacao_id: uuid,
      numero: textoOpcional(60),
      instrumento_id: uuid,
      financial_partner_id: z.string().uuid(v.financialPartnerObrigatorio),
      beneficiario_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      projeto_id: z.union([z.literal(""), uuid]).optional().transform((x) => x || null),
      pct_monetizacao: z.coerce.number({ invalid_type_error: v.pctNumero }).gt(0, v.pctMaiorZero).max(100, v.pctMax),
      comissao_pct: z.coerce.number({ invalid_type_error: v.pctNumero }).min(0, v.pctNegativo).max(100, v.pctMax).catch(0),
      status: z.enum(STATUS_MONETIZACAO, enumMsg(v.dadosInvalidos)).catch("negociacao"),
      data_oferta: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      data_pagamento: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      observacoes: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
    }).superRefine((m, ctx) => {
      if (!m.beneficiario_id && !m.projeto_id) {
        ctx.addIssue({ code: "custom", path: ["beneficiario_id"], message: v.destinoObrigatorio });
      }
    }),
    remuneracao: z.object({
      organizacao_id: uuid,
      projeto_id: uuid,
      tipo: z.enum(TIPOS_REMUNERACAO, enumMsg(v.dadosInvalidos)),
      valor: numeroPositivo(v.valor, MAX_VALOR),
      inicio: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      fim: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      observacoes: z.string().trim().max(1000, v.descricaoLonga).optional().transform((x) => x || null),
    }).superRefine((r, ctx) => {
      if (r.tipo !== "fixo_mensal" && r.tipo !== "por_unidade" && r.valor > 100) {
        ctx.addIssue({ code: "custom", path: ["valor"], message: v.pctMax });
      }
      if (r.inicio && r.fim && r.fim < r.inicio) ctx.addIssue({ code: "custom", path: ["fim"], message: v.periodoInvertido });
    }),
    /** Registro do documento DEPOIS de o arquivo subir ao bucket (0021). */
    documentoCliente: z.object({
      organizacao_id: uuid,
      cliente_id: uuid,
      tipo: z.enum(TIPOS_DOCUMENTO_CLIENTE, enumMsg(v.dadosInvalidos)),
      nome_arquivo: z.string().trim().min(1, v.nomeObrigatorio).max(200, v.nomeLongo),
      caminho: z.string().min(1).max(500),
      tamanho: z.coerce.number().int().min(0).max(20 * 1024 * 1024).optional(),
      mime: textoOpcional(120),
      emitido_em: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      validade: z.union([z.literal(""), dataISO]).optional().transform((x) => x || null),
      observacoes: z.string().trim().max(1000, v.descricaoLonga).optional().transform((x) => x || null),
    }).superRefine((x, ctx) => {
      // O caminho tem que começar pela pasta da empresa e do cliente — é o que o Storage confere.
      if (!x.caminho.startsWith(`${x.organizacao_id}/clientes/${x.cliente_id}/`)) {
        ctx.addIssue({ code: "custom", path: ["caminho"], message: v.dadosInvalidos });
      }
      if (x.emitido_em && x.validade && x.validade < x.emitido_em) {
        ctx.addIssue({ code: "custom", path: ["validade"], message: v.periodoInvertido });
      }
    }),
    statusInstrumento: z.object({ id: uuid, status: z.enum(STATUS_INSTRUMENTO, enumMsg(v.dadosInvalidos)) }),
    statusMonetizacao: z.object({ id: uuid, status: z.enum(STATUS_MONETIZACAO, enumMsg(v.dadosInvalidos)) }),
    id: z.object({ id: uuid, projeto_id: uuid }),
    /** Identificador isolado (edição/exclusão de projeto). */
    uuid,
  };
}

/** Só aceita caminhos internos para redirecionar após o login: "//evil.com" e "/\evil.com" seriam externos. */
export function caminhoInterno(v: unknown, padrao = "/painel"): string {
  return typeof v === "string" && /^\/(?![/\\])/.test(v) ? v : padrao;
}

/** Converte FormData em objeto simples. */
export function formParaObjeto(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === "string") obj[k] = v; });
  return obj;
}

export function primeiroErro(err: z.ZodError, padrao: string): string {
  return err.issues[0]?.message ?? padrao;
}
