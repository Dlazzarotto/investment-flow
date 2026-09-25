import { describe, expect, it } from "vitest";
import { caladoLimite, especificacaoDoGrade, fretePrincipalDo, laytimeDias } from "@/lib/catalogo";
import type { CommodityParametro, Local } from "@/lib/types";

const p = (x: Partial<CommodityParametro>): CommodityParametro => ({
  id: Math.random().toString(), commodity_id: "ferro", grade_id: null, nome: "Fe", unidade: "%",
  referencia: 62, minimo: null, maximo: null, ajuste_por_ponto: 0, ordem: 0, criado_em: "", ...x,
});
const l = (calado: number | null): Local => ({
  id: Math.random().toString(), organizacao_id: "o", nome: "x", tipo: "porto", pais: null, regiao: null, unlocode: null,
  calado_max_m: calado, observacoes: null, ativo: true, criado_em: "",
});

describe("especificação por grade", () => {
  const params = [p({ nome: "Fe padrão" }), p({ nome: "Fe 65", grade_id: "lump" }), p({ commodity_id: "soja", nome: "Umidade" })];
  it("grade com especificação própria usa a sua", () => {
    const r = especificacaoDoGrade(params, "ferro", "lump");
    expect(r.herdada).toBe(false);
    expect(r.itens.map((x) => x.nome)).toEqual(["Fe 65"]);
  });
  it("grade sem especificação herda a padrão da commodity — e avisa que herdou", () => {
    const r = especificacaoDoGrade(params, "ferro", "fines");
    expect(r.herdada).toBe(true);
    expect(r.itens.map((x) => x.nome)).toEqual(["Fe padrão"]);
  });
  it("nunca mistura parâmetros de outra commodity", () => {
    expect(especificacaoDoGrade(params, "ferro", null).itens.every((x) => x.commodity_id === "ferro")).toBe(true);
  });
});

describe("logística", () => {
  it("calado do navio é o MENOR dos portos em que ele opera (encalha no pior)", () => {
    expect(caladoLimite({ carga: l(9.75), descarga: l(20) })).toBe(9.75);
    expect(caladoLimite({ carga: l(null), descarga: l(null) })).toBeNull();
  });
  it("com transbordo, o terminal fluvial é da barcaça e não limita o navio", () => {
    // Puerto Aguirre 2,8 m (barcaça) → Nueva Palmira 9,75 m (transbordo) → Qingdao 20 m
    expect(caladoLimite({ carga: l(2.8), transbordo: l(9.75), descarga: l(20) })).toBe(9.75);
  });
  it("laytime = volume ÷ taxa; sem taxa é desconhecido, não zero", () => {
    expect(laytimeDias(50000, 12000)).toBe(4.17);
    expect(laytimeDias(50000, null)).toBeNull();
    expect(laytimeDias(50000, 0)).toBeNull();
  });
  it("frete principal pelo Incoterm 2020", () => {
    expect(fretePrincipalDo("FOB")).toBe("comprador");
    expect(fretePrincipalDo("FCA")).toBe("comprador");
    expect(fretePrincipalDo("CFR")).toBe("vendedor");
    expect(fretePrincipalDo("DAP")).toBe("vendedor");
  });
});
