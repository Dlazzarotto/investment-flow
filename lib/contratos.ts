/**
 * Contas do contrato comercial — puras, sem banco, com teste em tests/contratos.test.ts.
 *
 * O contrato ainda não tem embarque (etapa 2): tudo aqui é PROJEÇÃO pelo que foi
 * pactuado. Preço por fórmula só tem valor se houver um índice de referência;
 * sem ele o valor é desconhecido (null), nunca zero — zero pareceria um número real.
 */
import type { Contrato, Moeda, StatusContrato } from "./types";

type Campos = Pick<Contrato, "tipo_preco" | "preco_fixo" | "indice_referencia" | "premio" | "volume" | "tolerancia_pct"
  | "papel" | "comissao_base" | "comissao_valor" | "direcao" | "status" | "moeda" | "unidade" | "commodity_id">;

const n = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** Preço por unidade projetado: fixo, ou índice de referência ± prêmio. Null quando não há como saber. */
export function precoUnitario(c: Campos): number | null {
  if (c.tipo_preco === "fixo") return n(c.preco_fixo);
  const indice = n(c.indice_referencia);
  if (indice === null) return null;
  const p = indice + Number(c.premio ?? 0);
  // Desconto maior que o índice não é preço, é dado errado: melhor "não sei" do que negativo.
  return p > 0 ? p : null;
}

/** Valor da mercadoria no volume nominal. */
export function valorContrato(c: Campos): number | null {
  const p = precoUnitario(c);
  return p === null ? null : arred(p * Number(c.volume));
}

/** Faixa de volume que cumpre o contrato (tolerância ±). */
export function faixaVolume(c: Pick<Contrato, "volume" | "tolerancia_pct">): { min: number; max: number } {
  const v = Number(c.volume);
  const t = Number(c.tolerancia_pct ?? 0) / 100;
  // 3 casas, como o numeric(14,3) da coluna: 50 000 × 1,1 daria 55 000,000000000007.
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return { min: r3(v * (1 - t)), max: r3(v * (1 + t)) };
}

/**
 * O que o contrato rende para a EMPRESA. Como agente, é a comissão; como
 * principal, a empresa é dona da carga e o resultado só existe casando compra e
 * venda no embarque — aqui fica null.
 */
export function comissaoAgente(c: Campos): number | null {
  if (c.papel !== "agente" || c.comissao_valor === null || c.comissao_base === null) return null;
  const valor = Number(c.comissao_valor);
  if (c.comissao_base === "por_unidade") return arred(valor * Number(c.volume));
  const total = valorContrato(c);
  return total === null ? null : arred((total * valor) / 100);
}

/** Contratos que ainda vão movimentar carga ou dinheiro. */
export const STATUS_ATIVOS: readonly StatusContrato[] = ["assinado", "em_execucao"];

export interface ResumoContratos {
  ativos: number;
  emNegociacao: number;
  /** Volume ativo por commodity e unidade — toneladas não se somam com barris. */
  volumes: { commodity_id: string; unidade: string; venda: number; compra: number }[];
  /** Dinheiro por moeda. `semPreco` conta os contratos ativos cujo valor não dá para projetar. */
  valores: { moeda: Moeda; venda: number; compra: number; comissao: number; semPreco: number }[];
}

/** Consolidado para o painel da empresa. */
export function resumoContratos(contratos: Campos[]): ResumoContratos {
  const ativos = contratos.filter((c) => STATUS_ATIVOS.includes(c.status));
  const volumes = new Map<string, ResumoContratos["volumes"][number]>();
  const valores = new Map<Moeda, ResumoContratos["valores"][number]>();

  for (const c of ativos) {
    const kv = `${c.commodity_id}|${c.unidade}`;
    const vol = volumes.get(kv) ?? { commodity_id: c.commodity_id, unidade: c.unidade, venda: 0, compra: 0 };
    vol[c.direcao] += Number(c.volume);
    volumes.set(kv, vol);

    const din = valores.get(c.moeda) ?? { moeda: c.moeda, venda: 0, compra: 0, comissao: 0, semPreco: 0 };
    if (c.papel === "agente") {
      const com = comissaoAgente(c);
      if (com === null) din.semPreco += 1; else din.comissao += com;
    } else {
      const v = valorContrato(c);
      if (v === null) din.semPreco += 1; else din[c.direcao] += v;
    }
    valores.set(c.moeda, din);
  }

  return {
    ativos: ativos.length,
    emNegociacao: contratos.filter((c) => c.status === "rascunho").length,
    volumes: [...volumes.values()],
    valores: [...valores.values()].map((x) => ({
      ...x, venda: arred(x.venda), compra: arred(x.compra), comissao: arred(x.comissao),
    })),
  };
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}
