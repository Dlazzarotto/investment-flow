/** Esquemas zod com mensagens no idioma do usuário (usados pelas server actions). */
import { z } from "zod";
import { fmtTexto, type Dicionario } from "./i18n";
import {
  CATEGORIAS_DESPESA, CATEGORIAS_INVESTIMENTO, CATEGORIAS_RECEITA, MOEDAS, PAPEIS_MEMBRO,
  TIPOS_APORTE, TIPOS_PARCERIA, TIPOS_PARTICIPANTE,
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

  return {
    projeto: z.object({
      nome: z.string().trim().min(1, v.nomeProjeto).max(120, v.nomeLongo),
      descricao: z.string().trim().max(2000, v.descricaoLonga).optional().transform((x) => x || null),
      data_inicio: dataISO,
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      tipo_parceria: z.enum(TIPOS_PARCERIA, enumMsg(v.tipoParceriaInvalido)),
      participacao_pct: percentual,
    }),
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
    organizacao: z.object({
      nome: z.string().trim().min(1, v.nomeOrganizacao).max(120, v.nomeLongo),
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
    id: z.object({ id: uuid, projeto_id: uuid }),
    /** Identificador isolado (edição/exclusão de projeto). */
    uuid,
  };
}

/** Só aceita caminhos internos para redirecionar após o login: "//evil.com" e "/\evil.com" seriam externos. */
export function caminhoInterno(v: unknown, padrao = "/projetos"): string {
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
