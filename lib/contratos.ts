/**
 * Contas do contrato comercial — puras, sem banco, com teste em tests/contratos.test.ts.
 *
 * O contrato ainda não tem embarque (etapa 2): tudo aqui é PROJEÇÃO pelo que foi
 * pactuado. Preço por fórmula só tem valor se houver um índice de referência;
 * sem ele o valor é desconhecido (null), nunca zero — zero pareceria um número real.
 */
import type {
  Contrato, Instrumento, Moeda, Monetizacao, RemuneracaoGestao, StatusContrato, StatusInstrumento,
} from "./types";

type Campos = Pick<Contrato, "tipo_preco" | "preco_fixo" | "indice_referencia" | "premio" | "volume" | "tolerancia_pct"
  | "papel" | "comissao_base" | "comissao_valor" | "direcao" | "status" | "moeda" | "unidade" | "commodity_id"
  | "conta" | "projeto_id">;

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
  /**
   * Contagem por direção com o MESMO recorte das listas /vendas e /compras (todo
   * contrato daquela direção), para o cartão do painel e a lista que ele abre
   * mostrarem o mesmo número.
   */
  porDirecao: Record<"venda" | "compra", { ativos: number; negociacao: number }>;
  /**
   * Posição PRÓPRIA por commodity e unidade — só contratos em que a empresa é
   * dona da carga e por conta dela. Intermediação não é posição; contrato por
   * conta de projeto é posição do projeto, não da empresa.
   */
  volumes: { commodity_id: string; unidade: string; venda: number; compra: number }[];
  /**
   * Por moeda. venda/compra = operação própria (principal, por conta da empresa);
   * comissao = intermediação (agente), que é receita da empresa em qualquer conta.
   * `semPreco` conta os contratos ativos cujo valor não dá para projetar.
   */
  valores: { moeda: Moeda; venda: number; compra: number; comissao: number; semPreco: number }[];
  /** Sob gestão: contratos ativos por conta de projeto, que NÃO somam no resultado da empresa. */
  sobGestao: { projeto_id: string; moeda: Moeda; contratos: number; venda: number; compra: number; semPreco: number }[];
}

/** Consolidado para o painel da empresa. */
export function resumoContratos(contratos: Campos[]): ResumoContratos {
  const ativos = contratos.filter((c) => STATUS_ATIVOS.includes(c.status));
  const volumes = new Map<string, ResumoContratos["volumes"][number]>();
  const valores = new Map<Moeda, ResumoContratos["valores"][number]>();
  const gestao = new Map<string, ResumoContratos["sobGestao"][number]>();
  const din = (m: Moeda) => {
    const x = valores.get(m) ?? { moeda: m, venda: 0, compra: 0, comissao: 0, semPreco: 0 };
    valores.set(m, x);
    return x;
  };

  for (const c of ativos) {
    if (c.papel === "agente") {
      // Intermediação é receita da EMPRESA em qualquer conta (decisão já tomada). E
      // NÃO entra em "sob gestão": o projeto não é dono da carga — somar o valor
      // cheio dela ali contava o mesmo contrato duas vezes, em lugares opostos.
      const com = comissaoAgente(c);
      if (com === null) din(c.moeda).semPreco += 1; else din(c.moeda).comissao += com;
      continue;
    }
    if (c.conta === "projeto" && c.projeto_id) {
      const k = `${c.projeto_id}|${c.moeda}`;
      const g = gestao.get(k) ?? { projeto_id: c.projeto_id, moeda: c.moeda, contratos: 0, venda: 0, compra: 0, semPreco: 0 };
      g.contratos += 1;
      const v = valorContrato(c);
      if (v === null) g.semPreco += 1; else g[c.direcao] += v;
      gestao.set(k, g);
      continue;
    }
    const kv = `${c.commodity_id}|${c.unidade}`;
    const vol = volumes.get(kv) ?? { commodity_id: c.commodity_id, unidade: c.unidade, venda: 0, compra: 0 };
    vol[c.direcao] += Number(c.volume);
    volumes.set(kv, vol);
    const v = valorContrato(c);
    if (v === null) din(c.moeda).semPreco += 1; else din(c.moeda)[c.direcao] += v;
  }

  return {
    ativos: ativos.length,
    porDirecao: {
      venda: { ativos: ativos.filter((c) => c.direcao === "venda").length,
               negociacao: contratos.filter((c) => c.status === "rascunho" && c.direcao === "venda").length },
      compra: { ativos: ativos.filter((c) => c.direcao === "compra").length,
                negociacao: contratos.filter((c) => c.status === "rascunho" && c.direcao === "compra").length },
    },
    volumes: [...volumes.values()],
    valores: [...valores.values()].map((x) => ({
      ...x, venda: arred(x.venda), compra: arred(x.compra), comissao: arred(x.comissao),
    })),
    sobGestao: [...gestao.values()].map((x) => ({ ...x, venda: arred(x.venda), compra: arred(x.compra) })),
  };
}

// ---------------------------------------------------------------------------
// Monetização do instrumento (0019)
// ---------------------------------------------------------------------------

/** O que o Financial Partner paga: % do valor de FACE. */
export function valorMonetizado(valorFace: number, pctMonetizacao: number): number {
  return arred((Number(valorFace) * Number(pctMonetizacao)) / 100);
}

/** O que a empresa ganha: % do valor MONETIZADO — não do valor de face. */
export function comissaoMonetizacao(valorFace: number, pctMonetizacao: number, comissaoPct: number): number {
  return arred((valorMonetizado(valorFace, pctMonetizacao) * Number(comissaoPct)) / 100);
}

/** Monetização que ainda conta: em negociação é projeção, aprovada/paga é firme, cancelada sai. */
export interface ResumoMonetizacao { moeda: Moeda; monetizado: number; comissao: number; comissaoPaga: number }

export function resumoMonetizacoes(
  monetizacoes: Pick<Monetizacao, "instrumento_id" | "pct_monetizacao" | "comissao_pct" | "status">[],
  instrumentos: Pick<Instrumento, "id" | "valor_face" | "moeda">[],
): ResumoMonetizacao[] {
  const porId = new Map(instrumentos.map((i) => [i.id, i]));
  const m = new Map<Moeda, ResumoMonetizacao>();
  for (const x of monetizacoes) {
    if (x.status === "cancelada") continue;
    const inst = porId.get(x.instrumento_id);
    if (!inst) continue;
    const r = m.get(inst.moeda) ?? { moeda: inst.moeda, monetizado: 0, comissao: 0, comissaoPaga: 0 };
    r.monetizado += valorMonetizado(inst.valor_face, x.pct_monetizacao);
    const com = comissaoMonetizacao(inst.valor_face, x.pct_monetizacao, x.comissao_pct);
    r.comissao += com;
    if (x.status === "paga") r.comissaoPaga += com;
    m.set(inst.moeda, r);
  }
  return [...m.values()].map((r) => ({
    ...r, monetizado: arred(r.monetizado), comissao: arred(r.comissao), comissaoPaga: arred(r.comissaoPaga),
  }));
}

// ---------------------------------------------------------------------------
// Instrumentos: o que vence logo
// ---------------------------------------------------------------------------

const STATUS_ENCERRADOS: readonly StatusInstrumento[] = ["liquidado", "vencido", "cancelado"];

export interface AlertaInstrumento { instrumento_id: string; motivo: "apresentacao" | "validade"; data: string; dias: number }

/**
 * Prazo de apresentação e validade nos próximos `janela` dias (ou já passados)
 * de instrumentos em aberto. Perder o prazo de apresentação é perder o pagamento.
 * `hoje` em "AAAA-MM-DD"; a conta é em dias de calendário, em UTC.
 */
export function alertasInstrumentos(
  instrumentos: Pick<Instrumento, "id" | "status" | "validade" | "prazo_apresentacao">[],
  hoje: string, janela = 15,
): AlertaInstrumento[] {
  const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
  const h = dia(hoje);
  const out: AlertaInstrumento[] = [];
  for (const i of instrumentos) {
    if (STATUS_ENCERRADOS.includes(i.status)) continue;
    for (const [motivo, data] of [["apresentacao", i.prazo_apresentacao], ["validade", i.validade]] as const) {
      if (!data) continue;
      const dias = dia(data) - h;
      if (dias <= janela) out.push({ instrumento_id: i.id, motivo, data, dias });
    }
  }
  return out.sort((a, b) => a.dias - b.dias);
}

// ---------------------------------------------------------------------------
// Remuneração da gestão (o que a empresa ganha por administrar um projeto)
// ---------------------------------------------------------------------------

export interface BaseRemuneracao {
  /** Capital aportado no projeto (soma dos aportes). */
  capital: number;
  /** Valor e volume dos contratos de VENDA ativos por conta do projeto. */
  vendas: number | null;
  volumeVendas: number;
  /** Lucro do projeto, quando existir (etapas seguintes); null = ainda não há. */
  lucro: number | null;
}

/**
 * Base de cálculo de um projeto: vendas ATIVAS por conta dele. Contrato de venda
 * cujo valor não dá para projetar (fórmula sem índice) deixa `vendas` null — o %
 * sobre vendas fica "a confirmar" em vez de sair menor do que é.
 */
export function baseDoProjeto(contratos: Campos[], projetoId: string, capital: number, moeda?: Moeda): BaseRemuneracao {
  // Concluído também: a venda realizada é justamente a base de "% sobre vendas" — antes
  // a base caía a zero no momento em que o contrato era concluído. E só na moeda do
  // projeto: somar USD numa base rotulada em BRL dá um número que não existe.
  const vendas = contratos.filter((c) => c.conta === "projeto" && c.projeto_id === projetoId
    && c.direcao === "venda" && c.papel === "principal" && (STATUS_ATIVOS.includes(c.status) || c.status === "concluido")
    && (!moeda || c.moeda === moeda));
  const valores = vendas.map(valorContrato);
  return {
    capital,
    vendas: valores.some((v) => v === null) ? null : arred(valores.reduce<number>((a, v) => a + (v ?? 0), 0)),
    volumeVendas: vendas.reduce((a, c) => a + Number(c.volume), 0),
    lucro: null,
  };
}

/**
 * Projeção de cada linha de remuneração. Duas naturezas que NÃO se somam entre
 * si sem dizer: `porAno` (taxa de administração e fixo mensal, recorrentes) e
 * `sobContratos` (% de vendas e por unidade, sobre o que está contratado).
 * Performance só existe com lucro — sem ele fica null ("a confirmar").
 */
export function projetarRemuneracao(r: Pick<RemuneracaoGestao, "tipo" | "valor">, b: BaseRemuneracao):
  { porAno: number | null; sobContratos: number | null } {
  const v = Number(r.valor);
  switch (r.tipo) {
    case "taxa_adm_anual_pct": return { porAno: arred((b.capital * v) / 100), sobContratos: null };
    case "fixo_mensal": return { porAno: arred(v * 12), sobContratos: null };
    case "pct_vendas": return { porAno: null, sobContratos: b.vendas === null ? null : arred((b.vendas * v) / 100) };
    case "por_unidade": return { porAno: null, sobContratos: arred(b.volumeVendas * v) };
    case "performance_pct": return { porAno: null, sobContratos: b.lucro === null ? null : arred((Math.max(b.lucro, 0) * v) / 100) };
  }
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface ReceitaEmpresa {
  moeda: Moeda;
  /** Comissão de intermediação (contratos em que a empresa é agente). */
  intermediacao: number;
  /** Comissão de monetização (% do valor monetizado), exceto canceladas. */
  monetizacao: number;
  /** Gestão recorrente: taxa de administração e fixo mensal, por ano. */
  gestaoAno: number;
  /** Gestão sobre o contratado: % de vendas, por unidade e performance conhecida. */
  gestaoContratos: number;
}

/** Junta, por moeda, o que é receita da empresa — nunca soma moedas diferentes. */
export function receitaDaEmpresa(
  resumo: ResumoContratos, monetizacoes: ResumoMonetizacao[],
  gestao: { moeda: Moeda; porAno: number | null; sobContratos: number | null }[],
): ReceitaEmpresa[] {
  const m = new Map<Moeda, ReceitaEmpresa>();
  const r = (moeda: Moeda) => {
    const x = m.get(moeda) ?? { moeda, intermediacao: 0, monetizacao: 0, gestaoAno: 0, gestaoContratos: 0 };
    m.set(moeda, x);
    return x;
  };
  for (const v of resumo.valores) if (v.comissao) r(v.moeda).intermediacao += v.comissao;
  for (const x of monetizacoes) if (x.comissao) r(x.moeda).monetizacao += x.comissao;
  for (const g of gestao) {
    if (g.porAno) r(g.moeda).gestaoAno += g.porAno;
    if (g.sobContratos) r(g.moeda).gestaoContratos += g.sobContratos;
  }
  return [...m.values()].map((x) => ({
    ...x, intermediacao: arred(x.intermediacao), monetizacao: arred(x.monetizacao),
    gestaoAno: arred(x.gestaoAno), gestaoContratos: arred(x.gestaoContratos),
  }));
}

/**
 * Cronograma de pagamento negociado: o que entra antes (antecipado) e o saldo no
 * evento (carregamento, BL, documentos ou descarga). Null quando o valor do
 * contrato ainda não é conhecido (fórmula sem índice de referência).
 */
export function cronogramaPagamento(valor: number | null, pctAntecipado: number):
  { antecipado: number; saldo: number } | null {
  if (valor === null) return null;
  const antecipado = arred((valor * Number(pctAntecipado)) / 100);
  return { antecipado, saldo: arred(valor - antecipado) };
}
