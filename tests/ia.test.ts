import { describe, expect, it } from "vitest";
import { extrairJson, interpretarResposta, montarPrompt } from "@/lib/ia/estimativa";
import { desvioVsMedia, normalizarItem } from "@/lib/calculos";

const bom = `{"unidade_ref":"unidade","valor_min":400000,"valor_medio":520000,"valor_max":700000,"confianca":"media",
 "premissas":["Barcaça graneleira 2.000 t, usada, bacia amazônica","Cotação USD/BRL 5,2"],
 "fontes":[{"titulo":"Anúncio A","url":"https://exemplo.com/a"}],"observacao":null}`;

describe("Parser da resposta da IA", () => {
  it("aceita JSON puro", () => {
    const r = interpretarResposta(bom);
    expect(r.valor_medio).toBe(520000);
    expect(r.fontes[0].url).toBe("https://exemplo.com/a");
  });
  it("tolera cercas de markdown e texto ao redor", () => {
    const r = interpretarResposta("Aqui está a estimativa:\n```json\n" + bom + "\n```\nEspero ter ajudado.");
    expect(r.valor_min).toBe(400000);
  });
  it("coage números vindos como string", () => {
    const r = interpretarResposta(bom.replace('"valor_medio":520000', '"valor_medio":"520000"'));
    expect(r.valor_medio).toBe(520000);
  });
  it("rejeita faixa inconsistente (min > médio)", () => {
    expect(() => interpretarResposta(bom.replace('"valor_min":400000', '"valor_min":600000'))).toThrow(/mínimo ≤ médio ≤ máximo/);
  });
  it("rejeita valor médio zero (IA não encontrou nada)", () => {
    const zero = bom.replace('"valor_min":400000', '"valor_min":0').replace('"valor_medio":520000', '"valor_medio":0').replace('"valor_max":700000', '"valor_max":0');
    expect(() => interpretarResposta(zero)).toThrow(/não encontrou/);
  });
  it("rejeita fontes com URL inválida e texto sem JSON", () => {
    expect(() => interpretarResposta(bom.replace("https://exemplo.com/a", "site-a"))).toThrow();
    expect(() => extrairJson("sem json aqui")).toThrow(/não contém JSON/);
  });
  it("aplica defaults para campos opcionais", () => {
    const r = interpretarResposta('{"valor_min":1,"valor_medio":2,"valor_max":3}');
    expect(r).toMatchObject({ unidade_ref: "unidade", confianca: "media", premissas: [], fontes: [], observacao: null });
  });
});

describe("Prompt", () => {
  it("inclui item, contexto, moeda e exige JSON", () => {
    const p = montarPrompt({ item: "Empurrador 1.200 HP", contexto: "usado", moeda: "BRL", nomeProjeto: "JV Norte", locale: "pt" });
    expect(p).toContain("Empurrador 1.200 HP");
    expect(p).toContain("usado");
    expect(p).toContain("BRL (R$)");
    expect(p).toContain("SOMENTE com um objeto JSON");
    expect(p).toContain("Brazilian Portuguese");
    expect(montarPrompt({ item: "x", moeda: "USD", nomeProjeto: "P", locale: "zh" })).toContain("Simplified Chinese");
  });
});

describe("Comparação com a média", () => {
  it("normaliza o item como a coluna item_normalizado do banco", () => {
    expect(normalizarItem("  Barcaça 2000T ")).toBe("barcaça 2000t");
  });
  it("calcula o desvio relativo e devolve null sem média", () => {
    expect(desvioVsMedia(598000, 520000)).toBe(0.15);
    expect(desvioVsMedia(468000, 520000)).toBe(-0.1);
    expect(desvioVsMedia(100, 0)).toBeNull();
  });
});
