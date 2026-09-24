import { describe, expect, it } from "vitest";
import { comissaoAgente, faixaVolume, precoUnitario, resumoContratos, valorContrato } from "@/lib/contratos";
import type { Contrato } from "@/lib/types";

const base: Contrato = {
  id: "1", organizacao_id: "o", numero: null, contraparte_id: "c", commodity_id: "ferro", projeto_id: null,
  estimativa_id: null, direcao: "venda", papel: "principal", modalidade: "spot", status: "assinado",
  volume: 50000, tolerancia_pct: 10, unidade: "Toneladas", incoterm: "FOB", porto_embarque: null,
  porto_destino: null, moeda: "USD", tipo_preco: "fixo", preco_fixo: 100, indice: null, premio: 0,
  periodo_cotacao: null, indice_referencia: null, forma_pagamento: "lc", prazo_pagamento_dias: 0,
  pct_provisoria: null, comissao_base: null, comissao_valor: null, data_loi: null, data_icpo: null,
  data_sco: null, data_assinatura: null, inicio_entregas: null, fim_entregas: null, observacoes: null,
  criado_em: "", atualizado_em: "",
};
const c = (x: Partial<Contrato>): Contrato => ({ ...base, ...x });

describe("Contrato: preço e valor", () => {
  it("preço fixo", () => {
    expect(precoUnitario(base)).toBe(100);
    expect(valorContrato(base)).toBe(5_000_000);
  });
  it("fórmula = índice de referência ± prêmio (desconto negativo)", () => {
    const f = c({ tipo_preco: "formula", preco_fixo: null, indice: "Platts 62", indice_referencia: 105.5, premio: -8.5 });
    expect(precoUnitario(f)).toBe(97);
    expect(valorContrato(f)).toBe(4_850_000);
  });
  it("fórmula sem índice de referência: valor desconhecido (null), nunca zero", () => {
    const f = c({ tipo_preco: "formula", preco_fixo: null, indice: "LME", indice_referencia: null });
    expect(precoUnitario(f)).toBeNull();
    expect(valorContrato(f)).toBeNull();
  });
  it("desconto maior que o índice não vira preço negativo", () => {
    expect(precoUnitario(c({ tipo_preco: "formula", indice_referencia: 5, premio: -10 }))).toBeNull();
  });
  it("aceita os numerics como texto, como o PostgREST pode devolver", () => {
    expect(valorContrato(c({ volume: "1000.5" as unknown as number, preco_fixo: "10" as unknown as number }))).toBe(10005);
  });
  it("tolerância ±10 %", () => {
    expect(faixaVolume(base)).toEqual({ min: 45000, max: 55000 });
    expect(faixaVolume(c({ tolerancia_pct: 0 }))).toEqual({ min: 50000, max: 50000 });
  });
});

describe("Contrato: comissão do agente", () => {
  it("por unidade", () => {
    expect(comissaoAgente(c({ papel: "agente", comissao_base: "por_unidade", comissao_valor: 1.5 }))).toBe(75000);
  });
  it("percentual sobre o valor", () => {
    expect(comissaoAgente(c({ papel: "agente", comissao_base: "pct_valor", comissao_valor: 2 }))).toBe(100000);
  });
  it("percentual sem preço conhecido fica desconhecido", () => {
    expect(comissaoAgente(c({ papel: "agente", comissao_base: "pct_valor", comissao_valor: 2,
      tipo_preco: "formula", indice_referencia: null }))).toBeNull();
  });
  it("principal não tem comissão", () => {
    expect(comissaoAgente(base)).toBeNull();
  });
});

describe("Resumo dos contratos (painel)", () => {
  const lista: Contrato[] = [
    c({ id: "v1" }),                                                        // venda 5 M USD
    c({ id: "c1", direcao: "compra", preco_fixo: 80 }),                     // compra 4 M USD
    c({ id: "v2", status: "em_execucao", moeda: "BRL", preco_fixo: 10, volume: 100 }), // venda 1.000 BRL
    c({ id: "a1", papel: "agente", comissao_base: "por_unidade", comissao_valor: 2, volume: 1000 }), // comissão 2.000
    c({ id: "f1", tipo_preco: "formula", indice_referencia: null, indice: "LME" }),     // ativo sem preço
    c({ id: "r1", status: "rascunho" }),                                    // em negociação
    c({ id: "x1", status: "cancelado" }),                                   // fora de tudo
    c({ id: "k1", status: "concluido" }),                                   // fora de tudo
    c({ id: "b1", commodity_id: "petroleo", unidade: "Barris", volume: 10 }),
  ];
  const r = resumoContratos(lista);

  it("conta ativos (assinado + em execução) e em negociação (rascunho)", () => {
    expect(r.ativos).toBe(6);
    expect(r.emNegociacao).toBe(1);
  });
  it("dinheiro por moeda, sem somar BRL com USD; agente entra como comissão", () => {
    const usd = r.valores.find((v) => v.moeda === "USD")!;
    const brl = r.valores.find((v) => v.moeda === "BRL")!;
    expect(usd).toEqual({ moeda: "USD", venda: 5_001_000, compra: 4_000_000, comissao: 2000, semPreco: 1 });
    expect(brl).toEqual({ moeda: "BRL", venda: 1000, compra: 0, comissao: 0, semPreco: 0 });
  });
  it("volume por commodity e unidade — toneladas não se somam com barris", () => {
    const ferro = r.volumes.find((v) => v.commodity_id === "ferro")!;
    expect(ferro).toEqual({ commodity_id: "ferro", unidade: "Toneladas", venda: 50000 + 100 + 1000 + 50000, compra: 50000 });
    expect(r.volumes.find((v) => v.unidade === "Barris")!.venda).toBe(10);
  });
  it("lista vazia não quebra", () => {
    expect(resumoContratos([])).toEqual({ ativos: 0, emNegociacao: 0, volumes: [], valores: [] });
  });
});
