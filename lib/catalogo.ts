import type { Dicionario } from "@/lib/i18n";
import type { CommodityGrupo, CommodityParametro, GrupoPadrao, Local } from "@/lib/types";

/** Rótulo do grupo: o padrão sai do dicionário (4 idiomas); o da empresa, do nome. */
export function rotuloGrupo(g: CommodityGrupo, d: Dicionario): string {
  if (g.codigo) return d.enums.grupoCommodity[g.codigo as GrupoPadrao] ?? g.codigo;
  return g.nome ?? "—";
}

/**
 * Especificação que vale para um grade: a própria, se tiver; senão, a padrão da
 * commodity (parâmetros sem grade). É a regra "o grade herda o padrão" da 0029.
 */
export function especificacaoDoGrade(parametros: CommodityParametro[], commodityId: string, gradeId: string | null):
  { itens: CommodityParametro[]; herdada: boolean } {
  const daCommodity = parametros.filter((p) => p.commodity_id === commodityId);
  const proprios = gradeId ? daCommodity.filter((p) => p.grade_id === gradeId) : [];
  if (proprios.length > 0) return { itens: proprios, herdada: false };
  return { itens: daCommodity.filter((p) => p.grade_id === null), herdada: gradeId !== null };
}

/**
 * Calado que o NAVIO enfrenta: o menor entre os portos em que ele de fato opera.
 * Com transbordo, o navio oceânico carrega no transbordo — o trecho até lá é de
 * barcaça (hidrovia), e o calado de um terminal fluvial de 2,8 m não limita um
 * Supramax. Sem transbordo, ele carrega no ponto de carga. Um navio encalha no
 * pior ponto, não na média. Null quando nenhum desses portos informa calado.
 */
export function caladoLimite(r: { carga?: Local; transbordo?: Local; descarga?: Local }): number | null {
  const portos = r.transbordo ? [r.transbordo, r.descarga] : [r.carga, r.descarga];
  const valores = portos.map((l) => l?.calado_max_m).filter((x): x is number => x !== null && x !== undefined)
    .map(Number);
  return valores.length ? Math.min(...valores) : null;
}

/** Laytime em dias: volume ÷ taxa diária (arredondado a 2 casas). Sem taxa, desconhecido. */
export function laytimeDias(volume: number | null, taxaDia: number | null): number | null {
  if (!volume || !taxaDia || taxaDia <= 0) return null;
  return Math.round((volume / taxaDia) * 100) / 100;
}

/**
 * Quem contrata o frete principal pelo Incoterm 2020: nos grupos C e D, o
 * vendedor; nos E e F (EXW, FCA, FAS, FOB), o comprador.
 */
export function fretePrincipalDo(incoterm: string): "vendedor" | "comprador" {
  return ["CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].includes(incoterm) ? "vendedor" : "comprador";
}
