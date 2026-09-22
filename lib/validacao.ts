/** Esquemas zod com mensagens no idioma do usuário (usados pelas server actions). */
import { z } from "zod";
import { fmtTexto, type Dicionario } from "./i18n";
import {
  CATEGORIAS_INVESTIMENTO, CATEGORIAS_RECEITA, MOEDAS, TIPOS_PARCERIA, TIPOS_PARTICIPANTE,
} from "./types";

export function criarSchemas(d: Dicionario) {
  const v = d.validacao;
  const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v.dataInvalida);
  const numeroPositivo = (campo: string) =>
    z.coerce.number({ invalid_type_error: fmtTexto(v.numero, { campo }) })
      .finite().gt(0, fmtTexto(v.maiorZero, { campo }));
  const percentual = z.coerce.number({ invalid_type_error: v.pctNumero }).min(0, v.pctNegativo).max(100, v.pctMax);
  const enumMsg = (msg: string) => ({ errorMap: () => ({ message: msg }) });

  return {
    projeto: z.object({
      nome: z.string().trim().min(1, v.nomeProjeto).max(120, v.nomeLongo),
      descricao: z.string().trim().max(2000).optional().transform((x) => x || null),
      data_inicio: dataISO,
      moeda: z.enum(MOEDAS, enumMsg(v.moedaInvalida)),
      tipo_parceria: z.enum(TIPOS_PARCERIA, enumMsg(v.tipoParceriaInvalido)),
      participacao_pct: percentual,
    }),
    participante: z.object({
      projeto_id: z.string().uuid(),
      nome: z.string().trim().min(1, v.nomeParticipante).max(120, v.nomeLongo),
      tipo: z.enum(TIPOS_PARTICIPANTE, enumMsg(v.tipoParticipanteInvalido)),
      percentual: percentual.gt(0, v.pctMaiorZero),
      contato: z.string().trim().max(200).optional().transform((x) => x || null),
    }),
    investimento: z.object({
      projeto_id: z.string().uuid(),
      item: z.string().trim().min(1, v.itemObrigatorio).max(160, v.nomeLongo),
      categoria: z.enum(CATEGORIAS_INVESTIMENTO, enumMsg(v.categoriaInvalida)),
      quantidade: numeroPositivo(v.quantidade),
      valor_unitario: numeroPositivo(v.valorUnitario),
      data: dataISO,
    }),
    venda: z.object({
      projeto_id: z.string().uuid(),
      categoria: z.enum(CATEGORIAS_RECEITA, enumMsg(v.categoriaInvalida)),
      volume: numeroPositivo(v.volume),
      unidade: z.string().trim().min(1, v.unidadeObrigatoria).max(40),
      preco_unitario: numeroPositivo(v.precoUnitario),
      data: dataISO,
    }),
    id: z.object({ id: z.string().uuid(), projeto_id: z.string().uuid() }),
  };
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
