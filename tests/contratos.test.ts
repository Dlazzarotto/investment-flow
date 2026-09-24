import { describe, expect, it } from "vitest";
import {
  alertasInstrumentos, comissaoAgente, comissaoMonetizacao, faixaVolume, precoUnitario, projetarRemuneracao,
  cronogramaPagamento, receitaDaEmpresa, resumoContratos, resumoMonetizacoes, valorContrato, valorMonetizado, baseDoProjeto,
} from "@/lib/contratos";
import type { Contrato } from "@/lib/types";

const base: Contrato = {
  id: "1", organizacao_id: "o", numero: null, contraparte_id: "c", commodity_id: "ferro", projeto_id: null,
  estimativa_id: null, conta: "propria", assinante: "empresa", direcao: "venda", papel: "principal", modalidade: "spot", status: "assinado",
  volume: 50000, tolerancia_pct: 10, unidade: "Toneladas", incoterm: "FOB", porto_embarque: null,
  porto_destino: null, moeda: "USD", tipo_preco: "fixo", preco_fixo: 100, indice: null, premio: 0,
  periodo_cotacao: null, indice_referencia: null, pct_antecipado: 0, evento_saldo: "bl", prazo_pagamento_dias: 0,
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
    expect(r.ativosProprios).toBe(5); // o de agente é intermediação, não operação própria
    expect(r.emNegociacao).toBe(1);
  });
  it("dinheiro por moeda, sem somar BRL com USD; agente entra como comissão", () => {
    const usd = r.valores.find((v) => v.moeda === "USD")!;
    const brl = r.valores.find((v) => v.moeda === "BRL")!;
    expect(usd).toEqual({ moeda: "USD", venda: 5_001_000, compra: 4_000_000, comissao: 2000, semPreco: 1 });
    expect(brl).toEqual({ moeda: "BRL", venda: 1000, compra: 0, comissao: 0, semPreco: 0 });
  });
  it("posição por commodity e unidade — toneladas não se somam com barris; intermediação não é posição", () => {
    const ferro = r.volumes.find((v) => v.commodity_id === "ferro")!;
    expect(ferro).toEqual({ commodity_id: "ferro", unidade: "Toneladas", venda: 50000 + 100 + 50000, compra: 50000 });
    expect(r.volumes.find((v) => v.unidade === "Barris")!.venda).toBe(10);
  });
  it("lista vazia não quebra", () => {
    expect(resumoContratos([])).toEqual({ ativos: 0, ativosProprios: 0, emNegociacao: 0, volumes: [], valores: [], sobGestao: [] });
  });
  it("contrato por conta de projeto vai para 'sob gestão' e não infla a empresa", () => {
    const g = resumoContratos([
      c({ id: "p1", conta: "projeto", projeto_id: "mineradora" }),                       // venda 5 M do projeto
      c({ id: "p2", conta: "projeto", projeto_id: "mineradora", papel: "agente",       // intermediação no projeto:
          comissao_base: "pct_valor", comissao_valor: 2 }),                            // comissão é da EMPRESA
    ]);
    expect(g.volumes).toEqual([]);
    expect(g.valores).toEqual([{ moeda: "USD", venda: 0, compra: 0, comissao: 100_000, semPreco: 0 }]);
    expect(g.sobGestao).toEqual([{ projeto_id: "mineradora", moeda: "USD", contratos: 2, venda: 10_000_000, compra: 0, semPreco: 0 }]);
  });
});

describe("Monetização do instrumento", () => {
  it("FP paga 35 % do face; a empresa ganha 5 % do MONETIZADO, não do face", () => {
    expect(valorMonetizado(10_000_000, 35)).toBe(3_500_000);
    expect(comissaoMonetizacao(10_000_000, 35, 5)).toBe(175_000);
    expect(comissaoMonetizacao(10_000_000, 35, 5)).not.toBe(500_000); // 5 % do face seria o erro
  });
  it("resumo por moeda: cancelada sai, paga conta como recebida", () => {
    const inst = [{ id: "i1", valor_face: 10_000_000, moeda: "USD" as const }, { id: "i2", valor_face: 1_000_000, moeda: "EUR" as const }];
    const r = resumoMonetizacoes([
      { instrumento_id: "i1", pct_monetizacao: 35, comissao_pct: 5, status: "paga" },
      { instrumento_id: "i1", pct_monetizacao: 40, comissao_pct: 5, status: "cancelada" },
      { instrumento_id: "i2", pct_monetizacao: 50, comissao_pct: 4, status: "negociacao" },
    ], inst);
    expect(r).toEqual([
      { moeda: "USD", monetizado: 3_500_000, comissao: 175_000, comissaoPaga: 175_000 },
      { moeda: "EUR", monetizado: 500_000, comissao: 20_000, comissaoPaga: 0 },
    ]);
  });
});

describe("Instrumentos: alertas de prazo", () => {
  const hoje = "2026-09-24";
  it("prazo de apresentação e validade dentro da janela, do mais urgente ao menos", () => {
    const a = alertasInstrumentos([
      { id: "a", status: "recebido", prazo_apresentacao: "2026-10-01", validade: "2027-09-01" },
      { id: "b", status: "emitido", prazo_apresentacao: null, validade: "2026-09-20" },   // já venceu
      { id: "c", status: "liquidado", prazo_apresentacao: "2026-09-25", validade: null }, // encerrado: fora
      { id: "d", status: "recebido", prazo_apresentacao: "2026-12-01", validade: null },  // longe: fora
    ], hoje);
    expect(a).toEqual([
      { instrumento_id: "b", motivo: "validade", data: "2026-09-20", dias: -4 },
      { instrumento_id: "a", motivo: "apresentacao", data: "2026-10-01", dias: 7 },
    ]);
  });
  it("atravessa mês e ano sem erro de fuso", () => {
    expect(alertasInstrumentos([{ id: "x", status: "emitido", prazo_apresentacao: "2027-01-02", validade: null }], "2026-12-31")[0].dias).toBe(2);
  });
});

describe("Remuneração da gestão", () => {
  const b = { capital: 2_000_000, vendas: 5_000_000, volumeVendas: 50_000, lucro: null };
  it("taxa de administração e fixo mensal são por ano", () => {
    expect(projetarRemuneracao({ tipo: "taxa_adm_anual_pct", valor: 2 }, b)).toEqual({ porAno: 40_000, sobContratos: null });
    expect(projetarRemuneracao({ tipo: "fixo_mensal", valor: 5000 }, b)).toEqual({ porAno: 60_000, sobContratos: null });
  });
  it("% sobre vendas e por unidade são sobre o contratado", () => {
    expect(projetarRemuneracao({ tipo: "pct_vendas", valor: 1.5 }, b)).toEqual({ porAno: null, sobContratos: 75_000 });
    expect(projetarRemuneracao({ tipo: "por_unidade", valor: 1.2 }, b)).toEqual({ porAno: null, sobContratos: 60_000 });
    expect(projetarRemuneracao({ tipo: "pct_vendas", valor: 1.5 }, { ...b, vendas: null }).sobContratos).toBeNull();
  });
  it("performance só com lucro; prejuízo não gera taxa negativa", () => {
    expect(projetarRemuneracao({ tipo: "performance_pct", valor: 20 }, b).sobContratos).toBeNull();
    expect(projetarRemuneracao({ tipo: "performance_pct", valor: 20 }, { ...b, lucro: 1_000_000 }).sobContratos).toBe(200_000);
    expect(projetarRemuneracao({ tipo: "performance_pct", valor: 20 }, { ...b, lucro: -500 }).sobContratos).toBe(0);
  });
});

describe("Receita da empresa (painel)", () => {
  it("junta intermediação, monetização e gestão por moeda, sem misturar moedas", () => {
    const resumo = resumoContratos([c({ papel: "agente", comissao_base: "por_unidade", comissao_valor: 2, volume: 1000 })]);
    const r = receitaDaEmpresa(resumo,
      [{ moeda: "USD", monetizado: 3_500_000, comissao: 175_000, comissaoPaga: 0 }],
      [{ moeda: "USD", porAno: 40_000, sobContratos: null }, { moeda: "BRL", porAno: null, sobContratos: 60_000 }]);
    expect(r).toEqual([
      { moeda: "USD", intermediacao: 2000, monetizacao: 175_000, gestaoAno: 40_000, gestaoContratos: 0 },
      { moeda: "BRL", intermediacao: 0, monetizacao: 0, gestaoAno: 0, gestaoContratos: 60_000 },
    ]);
  });
  it("base do projeto: só vendas ativas por conta dele; valor desconhecido deixa o % 'a confirmar'", () => {
    const lista = [
      c({ id: "1", conta: "projeto", projeto_id: "p" }),                                   // 5 M, 50 000 t
      c({ id: "2", conta: "projeto", projeto_id: "p", status: "rascunho" }),               // fora: rascunho
      c({ id: "3", conta: "propria" }),                                                     // fora: própria
      c({ id: "4", conta: "projeto", projeto_id: "p", direcao: "compra" }),                 // fora: compra
    ];
    expect(baseDoProjeto(lista, "p", 100)).toEqual({ capital: 100, vendas: 5_000_000, volumeVendas: 50_000, lucro: null });
    const semPreco = [...lista, c({ id: "5", conta: "projeto", projeto_id: "p", tipo_preco: "formula", indice_referencia: null })];
    expect(baseDoProjeto(semPreco, "p", 0).vendas).toBeNull();
  });
});

describe("Pagamento negociado", () => {
  it("30 % antecipado e 70 % no evento; antecipado + saldo fecham o valor", () => {
    expect(cronogramaPagamento(5_000_000, 30)).toEqual({ antecipado: 1_500_000, saldo: 3_500_000 });
    const r = cronogramaPagamento(1234.57, 33.33)!;
    expect(r.antecipado + r.saldo).toBeCloseTo(1234.57, 2);
  });
  it("100 % no evento (ex.: venda FOB no país, no carregamento) e 100 % antecipado", () => {
    expect(cronogramaPagamento(135_000, 0)).toEqual({ antecipado: 0, saldo: 135_000 });
    expect(cronogramaPagamento(135_000, 100)).toEqual({ antecipado: 135_000, saldo: 0 });
  });
  it("sem valor conhecido não inventa cronograma", () => {
    expect(cronogramaPagamento(null, 30)).toBeNull();
  });
});
