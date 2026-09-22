import { describe, expect, it } from "vitest";
import { alocacaoPorCategoria, calcularKpis, encontrarBreakeven, ratearParticipacoes, totalParticipacao } from "@/lib/calculos";
import { criarSchemas } from "@/lib/validacao";
import { formatadores } from "@/lib/format";
import { obterDicionario } from "@/lib/i18n";
const { projeto: projetoSchema, participante: participanteSchema, investimento: investimentoSchema, venda: vendaSchema } = criarSchemas(obterDicionario("pt"));
const { data: fmtData, mesCurto: fmtMesCurto, mesLongo: fmtMesLongo, moeda: fmtMoeda, pct: fmtPct } = formatadores("pt");
import type { FluxoMensal } from "@/lib/types";

const inv = [
  { categoria: "logistica", valor_total: 1_000_000 },
  { categoria: "logistica", valor_total: 800_000 },
  { categoria: "infraestrutura", valor_total: 300_000 },
] as const;
const ven = [{ receita_total: 800_000 }, { receita_total: 1_700_000 }, { receita_total: 1_080_000 }];

// Mesma série validada no Postgres (tests/schema.test.sql)
const fluxo: FluxoMensal[] = [
  { mes: "2026-01-01", investimento: 1_000_000, receita: 0, inv_acumulado: 1_000_000, rec_acumulada: 0, saldo_acumulado: -1_000_000 },
  { mes: "2026-02-01", investimento: 1_100_000, receita: 0, inv_acumulado: 2_100_000, rec_acumulada: 0, saldo_acumulado: -2_100_000 },
  { mes: "2026-03-01", investimento: 0, receita: 800_000, inv_acumulado: 2_100_000, rec_acumulada: 800_000, saldo_acumulado: -1_300_000 },
  { mes: "2026-04-01", investimento: 0, receita: 1_700_000, inv_acumulado: 2_100_000, rec_acumulada: 2_500_000, saldo_acumulado: 400_000 },
  { mes: "2026-05-01", investimento: 0, receita: 0, inv_acumulado: 2_100_000, rec_acumulada: 2_500_000, saldo_acumulado: 400_000 },
  { mes: "2026-06-01", investimento: 0, receita: 1_080_000, inv_acumulado: 2_100_000, rec_acumulada: 3_580_000, saldo_acumulado: 1_480_000 },
];

describe("KPIs", () => {
  it("calcula totais, saldo e ROI", () => {
    const k = calcularKpis([...inv], ven);
    expect(k).toMatchObject({ investimentoTotal: 2_100_000, receitaTotal: 3_580_000, saldo: 1_480_000 });
    expect(k.roi).toBeCloseTo(1_480_000 / 2_100_000, 10);
  });
  it("ROI é null sem investimento", () => {
    expect(calcularKpis([], ven).roi).toBeNull();
    expect(calcularKpis([], []).saldo).toBe(0);
  });
  it("aceita valores vindos do banco como string", () => {
    expect(calcularKpis([{ valor_total: "10.50" as unknown as number }], [{ receita_total: "20" as unknown as number }]).saldo).toBe(9.5);
  });
});

describe("Break-even e alocação", () => {
  it("encontra o primeiro mês em que receita acumulada >= custo acumulado", () => {
    expect(encontrarBreakeven(fluxo)).toBe("2026-04-01");
  });
  it("retorna null quando não atingido ou sem dados", () => {
    expect(encontrarBreakeven(fluxo.slice(0, 3))).toBeNull();
    expect(encontrarBreakeven([])).toBeNull();
  });
  it("agrupa por categoria em ordem decrescente", () => {
    expect(alocacaoPorCategoria([...inv])).toEqual([
      { categoria: "logistica", valor: 1_800_000 }, { categoria: "infraestrutura", valor: 300_000 },
    ]);
  });
});

describe("Participação", () => {
  const k = calcularKpis([...inv], ven);
  it("rateia saldo/investimento/receita por %; dono primeiro; sem linha restante quando soma 100", () => {
    const r = ratearParticipacoes({ participacao_pct: 40 },
      [{ nome: "Mineradora X", tipo: "parceiro_jv", percentual: 35 }, { nome: "Fundo Y", tipo: "investidor", percentual: 25 }], k);
    expect(r.map((x) => x.nome)).toEqual(["Você", "Mineradora X", "Fundo Y"]);
    expect(r[0].saldoAtribuivel).toBe(592_000);
    expect(r[1].investimentoAtribuivel).toBe(735_000);
    expect(r[2].receitaAtribuivel).toBe(895_000);
    expect(r.reduce((s, x) => s + x.saldoAtribuivel, 0)).toBeCloseTo(k.saldo, 2);
  });
  it("adiciona 'Não alocado' quando a soma é < 100", () => {
    const r = ratearParticipacoes({ participacao_pct: 60 }, [], k);
    expect(r.at(-1)).toMatchObject({ nome: "Não alocado", percentual: 40, saldoAtribuivel: 592_000 });
    expect(totalParticipacao({ participacao_pct: 60 }, [{ percentual: 15.5 }])).toBe(75.5);
  });
});

describe("Validação (zod)", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  it("projeto: nome vazio, moeda/tipo inválidos e % fora da faixa falham", () => {
    const base = { nome: "JV", data_inicio: "2026-01-01", moeda: "USD", tipo_parceria: "joint_venture", participacao_pct: "40" };
    expect(projetoSchema.safeParse(base).success).toBe(true);
    expect(projetoSchema.safeParse({ ...base, nome: "   " }).success).toBe(false);
    expect(projetoSchema.safeParse({ ...base, moeda: "XYZ" }).success).toBe(false);
    expect(projetoSchema.safeParse({ ...base, tipo_parceria: "franquia" }).success).toBe(false);
    expect(projetoSchema.safeParse({ ...base, participacao_pct: "101" }).success).toBe(false);
    expect(projetoSchema.safeParse({ ...base, descricao: "" }).data?.descricao).toBeNull();
  });
  it("investimento e venda: números devem ser > 0 e vindos de FormData (string)", () => {
    const i = { projeto_id: uuid, item: "Barcaças", categoria: "logistica", quantidade: "4", valor_unitario: "250000", data: "2026-01-20" };
    expect(investimentoSchema.safeParse(i).data?.quantidade).toBe(4);
    expect(investimentoSchema.safeParse({ ...i, quantidade: "0" }).success).toBe(false);
    expect(investimentoSchema.safeParse({ ...i, valor_unitario: "abc" }).success).toBe(false);
    expect(investimentoSchema.safeParse({ ...i, item: "" }).error?.issues[0].message).toMatch(/obrigatório/);
    const v = { projeto_id: uuid, categoria: "venda_produto", volume: "10000", unidade: "Toneladas", preco_unitario: "80", data: "2026-03-01" };
    expect(vendaSchema.safeParse(v).success).toBe(true);
    expect(vendaSchema.safeParse({ ...v, preco_unitario: "-1" }).success).toBe(false);
    expect(vendaSchema.safeParse({ ...v, data: "01/03/2026" }).success).toBe(false);
  });
  it("participante: percentual > 0 e <= 100", () => {
    const p = { projeto_id: uuid, nome: "Fundo Y", tipo: "investidor", percentual: "25" };
    expect(participanteSchema.safeParse(p).success).toBe(true);
    expect(participanteSchema.safeParse({ ...p, percentual: "0" }).success).toBe(false);
    expect(participanteSchema.safeParse({ ...p, tipo: "gerente" }).success).toBe(false);
  });
});

describe("Formatação", () => {
  it("datas sem fuso horário e moeda pt-BR", () => {
    expect(fmtData("2026-03-01")).toBe("01/03/2026");
    expect(fmtMesCurto("2026-03-01")).toBe("mar/26");
    expect(fmtMesLongo("2026-12-01")).toBe("dezembro de 2026");
    expect(fmtMoeda(1234.5, "USD")).toMatch(/US\$\s?1\.234,50/);
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(0.7048)).toBe("70,5 %");
  });
});
