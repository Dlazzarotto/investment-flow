"use client";
import { useI18n } from "@/lib/i18n/client";
import { PREFIXO_MERCADO } from "@/lib/adocao-constantes";
import type { Commodity, CommodityPadrao } from "@/lib/types";

/**
 * As <option> de um seletor de commodity: as da empresa e, abaixo, o catálogo do
 * mercado ainda não adotado (valor "mercado:<codigo>", adotado pelo servidor ao
 * salvar). Sem o catálogo, empresa que não cadastrou nada via um seletor vazio.
 */
export function OpcoesCommodity({ commodities, catalogo, incluir = [] }:
  { commodities: Commodity[]; catalogo: CommodityPadrao[]; incluir?: string[] }) {
  const { d } = useI18n();
  const daEmpresa = commodities.filter((c) => c.ativo || incluir.includes(c.id));
  const adotados = new Set(commodities.map((c) => c.padrao_codigo).filter(Boolean));
  const doMercado = catalogo.filter((p) => !adotados.has(p.codigo));
  return (
    <>
      {daEmpresa.length > 0 && (
        <optgroup label={d.contratos.daEmpresa}>
          {daEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </optgroup>
      )}
      {doMercado.length > 0 && (
        <optgroup label={d.contratos.doMercado}>
          {doMercado.map((p) => <option key={p.codigo} value={`${PREFIXO_MERCADO}${p.codigo}`}>{d.enums.commodityPadrao[p.codigo]}</option>)}
        </optgroup>
      )}
    </>
  );
}
