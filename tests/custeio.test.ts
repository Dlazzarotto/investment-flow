import { describe, expect, it } from "vitest";
import { calcularCusteio, converterItem, ehPercentual, margemNoPreco } from "@/lib/custeio";
import type { DriverCusto, EstimativaItem, GrupoCusto } from "@/lib/types";

/** Parâmetros de um lote de 10.000 t produzindo 500 t/dia. */
const p = { volume_total: 10_000, producao_diaria: 500, dias_mes: 30, margem_alvo_pct: 0 };

let n = 0;
function item(grupo: GrupoCusto, nome: string, driver: DriverCusto, valor: number,
              quantidade = 1, capacidade: number | null = null, etapa_id: string | null = null): EstimativaItem {
  n += 1;
  return {
    id: `i${n}`, estimativa_id: "e1", etapa_id, grupo, nome, driver, valor, quantidade, capacidade,
    origem: "manual", fonte: null, ordem: n, criado_em: "2026-01-01T00:00:00Z",
  };
}

/** Atalho para converterItem sem repetir capacidade: null em todo teste. */
function conv(driver: DriverCusto, valor: number, quantidade = 1, capacidade: number | null = null) {
  return converterItem({ driver, valor, quantidade, capacidade }, p);
}

describe("Conversão de cada driver para custo por tonelada", () => {
  it("por_unidade usa o valor direto, multiplicado pela quantidade", () => {
    expect(conv("por_unidade", 12).porUnidade).toBe(12);
    expect(conv("por_unidade", 12, 3).porUnidade).toBe(36);
  });
  it("por_dia divide pela produção diária — 3 operadores a 300/dia com 500 t/dia = 1,80/t", () => {
    expect(conv("por_dia", 300, 3).porUnidade).toBeCloseTo(1.8, 10);
  });
  it("por_mes divide pelos dias do mês e pela produção diária", () => {
    // 150.000/mês ÷ 30 dias = 5.000/dia ÷ 500 t/dia = 10/t
    expect(conv("por_mes", 150_000).porUnidade).toBeCloseTo(10, 10);
  });
  it("por_lote divide pelo volume total do lote", () => {
    expect(conv("por_lote", 50_000).porUnidade).toBe(5);
  });
  it("percentuais não viram R$/t sozinhos: dependem do custo ou do preço", () => {
    expect(conv("pct_custo", 10).porUnidade).toBeNull();
    expect(conv("pct_receita", 10).porUnidade).toBeNull();
    expect(ehPercentual("pct_receita")).toBe(true);
    expect(ehPercentual("por_dia")).toBe(false);
  });
  it("por_viagem divide pela capacidade — frete de 2.400 por caminhão de 30 t = 80/t", () => {
    expect(conv("por_viagem", 2_400, 1, 30).porUnidade).toBe(80);
    // barcaça de 1.500 t a 45.000 por viagem = 30/t
    expect(conv("por_viagem", 45_000, 1, 1_500).porUnidade).toBe(30);
  });
  it("por_viagem sem capacidade fica marcado em vez de virar zero", () => {
    const r = conv("por_viagem", 2_400, 1, null);
    expect(r.porUnidade).toBeNull();
    expect(r.impedimento).toBe("sem_capacidade");
  });
  it("custo por dia sem produção diária não vira zero em silêncio — fica marcado", () => {
    const r = converterItem({ driver: "por_dia", valor: 300, quantidade: 1, capacidade: null },
                            { ...p, producao_diaria: 0 });
    expect(r.porUnidade).toBeNull();
    expect(r.impedimento).toBe("sem_producao_diaria");
  });
});

describe("Cálculo reverso: do custo para o preço", () => {
  it("sem percentuais nem margem, o preço é o próprio custo", () => {
    const r = calcularCusteio([item("producao", "Extração", "por_unidade", 40)], p);
    expect(r.custoUnitario).toBe(40);
    expect(r.preco).toBe(40);
    expect(r.margemPorUnidade).toBe(0);
  });

  it("impostos e margem entram pela equação, não empilhados", () => {
    // custo 40/t, impostos 10 % da receita, margem alvo 20 %
    // errado seria 40 × 1,10 × 1,20 = 52,80 — o imposto incidiria sobre o preço menor
    // certo: 40 / (1 − 0,10 − 0,20) = 57,14
    const r = calcularCusteio([
      item("producao", "Extração", "por_unidade", 40),
      item("tributos", "Impostos", "pct_receita", 10),
    ], { ...p, margem_alvo_pct: 20 });
    expect(r.custoUnitario).toBe(40);
    expect(r.preco).toBeCloseTo(57.14, 2);
    // e o preço se sustenta: receita − imposto − custo = margem
    expect(r.preco! - r.impostosPorUnidade - r.custoUnitario).toBeCloseTo(r.margemPorUnidade, 1);
    expect(r.margemPorUnidade / r.preco!).toBeCloseTo(0.2, 4);
  });

  it("vários percentuais sobre a receita somam antes de entrar na equação", () => {
    const r = calcularCusteio([
      item("producao", "Extração", "por_unidade", 50),
      item("tributos", "CFEM", "pct_receita", 3.5),
      item("outros", "Comissão", "pct_receita", 1.5),
    ], { ...p, margem_alvo_pct: 15 });
    expect(r.taxaSobreReceita).toBeCloseTo(0.05, 10);
    expect(r.preco).toBeCloseTo(50 / 0.8, 2);
  });

  it("pct_custo incide sobre o custo direto e não depende da ordem dos itens", () => {
    const base = [item("producao", "Extração", "por_unidade", 100), item("administrativo", "Overhead", "pct_custo", 10)];
    const r1 = calcularCusteio(base, p);
    const r2 = calcularCusteio([...base].reverse(), p);
    expect(r1.custoDireto).toBe(100);
    expect(r1.custoIndireto).toBe(10);
    expect(r1.custoUnitario).toBe(110);
    expect(r2.custoUnitario).toBe(r1.custoUnitario);
  });

  it("impostos + margem consumindo 100 % da receita torna o preço impossível", () => {
    const r = calcularCusteio([
      item("producao", "Extração", "por_unidade", 40),
      item("tributos", "Impostos", "pct_receita", 60),
    ], { ...p, margem_alvo_pct: 40 });
    expect(r.impossivel).toBe(true);
    expect(r.preco).toBeNull();
    expect(r.receitaTotal).toBe(0);
  });

  it("soma os grupos e separa os itens que não deram para converter", () => {
    const r = calcularCusteio([
      item("producao", "Extração", "por_unidade", 30),
      item("producao", "Combustível", "por_unidade", 10),
      item("pessoal", "Equipe", "por_dia", 5_000),
      item("porto", "Taxa portuária", "por_lote", 20_000),
    ], { ...p, producao_diaria: 0 });
    // pessoal ficou de fora: sem produção diária não há como ratear
    expect(r.itensIgnorados.map((i) => i.nome)).toEqual(["Equipe"]);
    expect(r.porGrupo).toEqual([
      { grupo: "producao", valor: 40 },
      { grupo: "porto", valor: 2 },
    ]);
    expect(r.custoUnitario).toBe(42);
  });

  it("soma o custo por etapa da cadeia, e o que está fora de etapa fica separado", () => {
    const r = calcularCusteio([
      item("producao", "Extração", "por_unidade", 30, 1, null, "etapa-mina"),
      item("pessoal", "Equipe da mina", "por_dia", 5_000, 1, null, "etapa-mina"),
      item("logistica_interna", "Caminhão até Porto Bush", "por_viagem", 2_400, 1, 30, "etapa-terrestre"),
      item("administrativo", "Escritório", "por_mes", 30_000),
    ], p);
    const porEtapa = Object.fromEntries(r.porEtapa.map((e) => [e.etapaId ?? "sem_etapa", e.valor]));
    // mina: 30/t de extração + 5.000/dia ÷ 500 t/dia = 10/t → 40/t
    expect(porEtapa["etapa-mina"]).toBe(40);
    // terrestre: 2.400 por caminhão de 30 t = 80/t
    expect(porEtapa["etapa-terrestre"]).toBe(80);
    // administrativo não pertence a etapa: 30.000/mês ÷ 30 ÷ 500 = 2/t
    expect(porEtapa["sem_etapa"]).toBe(2);
    expect(r.custoUnitario).toBe(122);
  });

  it("estimativa vazia não quebra", () => {
    const r = calcularCusteio([], p);
    expect(r).toMatchObject({ custoUnitario: 0, preco: 0, custoTotal: 0, receitaTotal: 0, impossivel: false });
    expect(r.porGrupo).toEqual([]);
  });

  it("totais do lote acompanham o volume", () => {
    const r = calcularCusteio([item("producao", "Extração", "por_unidade", 40)], { ...p, margem_alvo_pct: 20 });
    expect(r.custoTotal).toBe(40 * 10_000);
    expect(r.receitaTotal).toBeCloseTo(r.preco! * 10_000, 2);
  });
});

describe("Comparação com o preço de mercado", () => {
  const r = calcularCusteio([
    item("producao", "Extração", "por_unidade", 40),
    item("tributos", "Impostos", "pct_receita", 10),
  ], { ...p, margem_alvo_pct: 20 });

  it("vender pelo preço calculado devolve exatamente a margem alvo", () => {
    expect(margemNoPreco(r, r.preco!)).toBeCloseTo(0.2, 4);
  });
  it("preço de mercado acima do calculado melhora a margem, e abaixo piora", () => {
    expect(margemNoPreco(r, 70)!).toBeGreaterThan(0.2);
    expect(margemNoPreco(r, 50)!).toBeLessThan(0.2);
  });
  it("preço que não cobre nem o custo devolve margem negativa", () => {
    expect(margemNoPreco(r, 30)!).toBeLessThan(0);
  });
  it("preço inválido devolve null", () => {
    expect(margemNoPreco(r, 0)).toBeNull();
    expect(margemNoPreco(r, -5)).toBeNull();
  });
});
