import { describe, expect, it } from "vitest";
import {
  MESES_MINIMOS_ANUALIZAR, alocacaoPorCategoria, calcularKpis, despesasPorCategoria, detalharCustoVenda, resumoAportes,
  encontrarBreakeven, ratearParticipacoes, roiAnualizado, simularCenarios, tirAnual, tirMensal,
  totalParticipacao, vpl,
} from "@/lib/calculos";
import { caminhoInterno, criarSchemas } from "@/lib/validacao";
import { permissoes } from "@/lib/permissoes";
import { formatadores, hojeISO } from "@/lib/format";
import { obterDicionario } from "@/lib/i18n";
const { projeto: projetoSchema, participante: participanteSchema, investimento: investimentoSchema, venda: vendaSchema } = criarSchemas(obterDicionario("pt"));
const { data: fmtData, mesCurto: fmtMesCurto, mesLongo: fmtMesLongo, moeda: fmtMoeda, pct: fmtPct } = formatadores("pt");
import type { FluxoMensal } from "@/lib/types";

const inv = [
  { categoria: "logistica", valor_total: 1_000_000 },
  { categoria: "logistica", valor_total: 800_000 },
  { categoria: "infraestrutura", valor_total: 300_000 },
] as const;
const ven = [
  { receita_total: 800_000, custo_total: 0 },
  { receita_total: 1_700_000, custo_total: 0 },
  { receita_total: 1_080_000, custo_total: 0 },
];

/** Série sem custo de venda nem despesa: a saída é só o aporte (como era antes de 0005). */
function linha(mes: string, investimento: number, receita: number, custo_vendas = 0, despesas = 0) {
  return { mes, investimento, custo_vendas, despesas, saida: investimento + custo_vendas + despesas, receita };
}
function acumular(linhas: ReturnType<typeof linha>[]): FluxoMensal[] {
  let sa = 0, ra = 0;
  return linhas.map((l) => {
    sa += l.saida; ra += l.receita;
    return { ...l, saida_acumulada: sa, rec_acumulada: ra, saldo_acumulado: ra - sa };
  });
}

// Mesma série validada no Postgres (tests/schema.test.sql)
const fluxo: FluxoMensal[] = acumular([
  linha("2026-01-01", 1_000_000, 0),
  linha("2026-02-01", 1_100_000, 0),
  linha("2026-03-01", 0, 800_000),
  linha("2026-04-01", 0, 1_700_000),
  linha("2026-05-01", 0, 0),
  linha("2026-06-01", 0, 1_080_000),
]);

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
    expect(calcularKpis([{ valor_total: "10.50" as unknown as number }],
      [{ receita_total: "20" as unknown as number, custo_total: "0" as unknown as number }]).saldo).toBe(9.5);
  });
});

describe("Custo da venda e despesas", () => {
  // 10.000 t × 80 = 800.000 de receita; mercadoria 450.000, frete 80.000,
  // impostos 3,5 % = 28.000, comissão 1,5 % = 12.000 → custo 570.000, margem 230.000
  const venda = { volume: 10_000, preco_unitario: 80, custo_unitario: 45, frete_unitario: 8, impostos_pct: 3.5, comissao_pct: 1.5 };

  it("quebra o custo da venda nos quatro componentes, igual à coluna gerada do banco", () => {
    expect(detalharCustoVenda(venda)).toEqual({
      mercadoria: 450_000, frete: 80_000, impostos: 28_000, comissao: 12_000,
      total: 570_000, margem: 230_000, margemPct: 230_000 / 800_000,
    });
  });
  it("venda sem custo lançado mantém a receita inteira como margem", () => {
    const r = detalharCustoVenda({ volume: 100, preco_unitario: 10, custo_unitario: 0, frete_unitario: 0, impostos_pct: 0, comissao_pct: 0 });
    expect(r).toMatchObject({ total: 0, margem: 1000, margemPct: 1 });
  });
  it("margem pode ficar negativa quando o custo supera a receita", () => {
    const r = detalharCustoVenda({ volume: 10, preco_unitario: 10, custo_unitario: 12, frete_unitario: 0, impostos_pct: 0, comissao_pct: 0 });
    expect(r.margem).toBe(-20);
    expect(r.margemPct).toBeCloseTo(-0.2, 10);
  });

  it("KPIs descontam custo de venda e despesa do saldo, e o ROI segue sobre o aporte", () => {
    const k = calcularKpis(
      [{ valor_total: 1_000_000 }],
      [{ receita_total: 800_000, custo_total: 570_000 }],
      [{ valor: 60_000 }, { valor: 40_000 }],
    );
    expect(k).toMatchObject({
      investimentoTotal: 1_000_000, receitaTotal: 800_000, custoVendasTotal: 570_000,
      despesasTotal: 100_000, saidaTotal: 1_670_000, margemBruta: 230_000, saldo: -870_000,
    });
    expect(k.margemPct).toBeCloseTo(230_000 / 800_000, 10);
    expect(k.roi).toBeCloseTo(-870_000 / 1_000_000, 10);
  });
  it("sem despesas o resultado é o de antes (compatível com o que já estava lançado)", () => {
    const k = calcularKpis([...inv], ven);
    expect(k).toMatchObject({ investimentoTotal: 2_100_000, receitaTotal: 3_580_000, custoVendasTotal: 0, saldo: 1_480_000 });
  });
  it("agrupa despesas por categoria em ordem decrescente", () => {
    expect(despesasPorCategoria([
      { categoria: "pessoal", valor: 60_000 }, { categoria: "combustivel", valor: 40_000 }, { categoria: "pessoal", valor: 15_000 },
    ])).toEqual([{ categoria: "pessoal", valor: 75_000 }, { categoria: "combustivel", valor: 40_000 }]);
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
  it("rateia saldo/investimento/receita por %; dono primeiro (sem nome — a tela traduz); sem linha restante quando soma 100", () => {
    const r = ratearParticipacoes({ participacao_pct: 40 },
      [{ nome: "Mineradora X", tipo: "parceiro_jv", percentual: 35 }, { nome: "Fundo Y", tipo: "investidor", percentual: 25 }], k);
    expect(r.map((x) => [x.tipo, x.nome])).toEqual([["dono", ""], ["parceiro_jv", "Mineradora X"], ["investidor", "Fundo Y"]]);
    expect(r[0].saldoAtribuivel).toBe(592_000);
    expect(r[1].investimentoAtribuivel).toBe(735_000);
    expect(r[2].receitaAtribuivel).toBe(895_000);
    expect(r.reduce((s, x) => s + x.saldoAtribuivel, 0)).toBeCloseTo(k.saldo, 2);
  });
  it("adiciona a linha 'restante' quando a soma é < 100", () => {
    const r = ratearParticipacoes({ participacao_pct: 60 }, [], k);
    expect(r.at(-1)).toMatchObject({ tipo: "restante", nome: "", percentual: 40, saldoAtribuivel: 592_000 });
    expect(totalParticipacao({ participacao_pct: 60 }, [{ percentual: 15.5 }])).toBe(75.5);
  });
});

describe("Retorno no tempo", () => {
  it("ROI anualizado converte o retorno do período em taxa equivalente ao ano", () => {
    // 21 % em 24 meses ≈ 10 % ao ano (1,1² = 1,21)
    expect(roiAnualizado(0.21, 24)).toBeCloseTo(0.1, 6);
    // em 12 meses a taxa anual é o próprio ROI
    expect(roiAnualizado(0.7048, 12)).toBeCloseTo(0.7048, 10);
    // meio ano de 10 % equivale a 21 % ao ano
    expect(roiAnualizado(0.1, 6)).toBeCloseTo(0.21, 6);
  });
  it("ROI anualizado: null sem ROI, null com período curto demais, −100 % quando não houve receita", () => {
    expect(roiAnualizado(null, 24)).toBeNull();
    expect(roiAnualizado(0.5, MESES_MINIMOS_ANUALIZAR - 1)).toBeNull();
    expect(roiAnualizado(0.5, MESES_MINIMOS_ANUALIZAR)).not.toBeNull();
    expect(roiAnualizado(-1, 12)).toBe(-1);
  });

  it("VPL desconta cada mês pela taxa e a TIR zera o VPL", () => {
    const f = [-1000, 300, 400, 500];
    expect(vpl(f, 0)).toBe(200);
    const tir = tirMensal(f)!;
    expect(tir).toBeGreaterThan(0);
    expect(vpl(f, tir)).toBeCloseTo(0, 6);
  });
  it("TIR devolve a taxa exata de um caso conhecido", () => {
    // aporte de 100 que devolve 110 um mês depois = 10 % ao mês
    expect(tirMensal([-100, 110])).toBeCloseTo(0.1, 8);
    expect(tirAnual([-100, 110])).toBeCloseTo(Math.pow(1.1, 12) - 1, 6);
  });
  it("TIR é null sem troca de sinal ou com série curta", () => {
    expect(tirMensal([100, 200])).toBeNull();
    expect(tirMensal([-100, -200])).toBeNull();
    expect(tirMensal([0, 0, 0])).toBeNull();
    expect(tirMensal([-100])).toBeNull();
    expect(tirAnual([500])).toBeNull();
  });
  it("TIR negativa quando o projeto devolve menos do que custou", () => {
    const tir = tirMensal([-1000, 100, 100, 100])!;
    expect(tir).toBeLessThan(0);
    expect(vpl([-1000, 100, 100, 100], tir)).toBeCloseTo(0, 6);
  });

  it("cenários: base reproduz o real; otimista e pessimista deslocam receita e custo", () => {
    const [oti, base, pes] = simularCenarios(fluxo, { receita: 0.15, investimento: 0.1 });
    expect(base.saidaTotal).toBe(2_100_000);
    expect(base.receitaTotal).toBe(3_580_000);
    expect(base.saldo).toBe(1_480_000);
    expect(base.breakeven).toBe("2026-04-01");
    expect(base.meses).toBe(6);

    expect(oti.receitaTotal).toBeCloseTo(3_580_000 * 1.15, 2);
    expect(oti.saidaTotal).toBeCloseTo(2_100_000 * 0.9, 2);
    expect(oti.saldo).toBeGreaterThan(base.saldo);
    expect(oti.roi!).toBeGreaterThan(base.roi!);

    expect(pes.receitaTotal).toBeCloseTo(3_580_000 * 0.85, 2);
    expect(pes.saidaTotal).toBeCloseTo(2_100_000 * 1.1, 2);
    expect(pes.saldo).toBeLessThan(base.saldo);
    expect(pes.roi!).toBeLessThan(base.roi!);
  });
  it("cenários: o break-even pode mudar de mês e a ordem é otimista → base → pessimista", () => {
    const r = simularCenarios(fluxo, { receita: 0.5, investimento: 0.5 });
    expect(r.map((x) => x.cenario)).toEqual(["otimista", "base", "pessimista"]);
    // receita +50 % e custo −50 %: o break-even antecipa
    expect(r[0].breakeven).toBe("2026-03-01");
    // receita −50 % e custo +50 %: não chega ao equilíbrio na série
    expect(r[2].breakeven).toBeNull();
  });
  it("cenários: fluxo vazio não quebra e devolve tudo zerado", () => {
    const r = simularCenarios([]);
    expect(r).toHaveLength(3);
    expect(r[1]).toMatchObject({ saidaTotal: 0, receitaTotal: 0, saldo: 0, roi: null, tirAnual: null, breakeven: null, meses: 0 });
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
  it("projeto (0022): a empresa administra — sem participação informada vale 0 %, sem tipo de parceria é aceito", () => {
    const novo = projetoSchema.safeParse({ nome: "Mineradora", data_inicio: "2026-09-22", moeda: "USD" });
    expect(novo.success).toBe(true);
    expect(novo.data?.participacao_pct).toBe(0);
    expect(novo.data?.status).toBe("em_andamento");
    expect(projetoSchema.safeParse({ nome: "M", data_inicio: "2026-09-22", moeda: "USD", participacao_pct: "" }).data?.participacao_pct).toBe(0);
    expect(projetoSchema.safeParse({ nome: "M", data_inicio: "2026-09-22", moeda: "USD", participacao_pct: "101" }).success).toBe(false);
    expect(projetoSchema.safeParse({ nome: "M", data_inicio: "2026-09-22", moeda: "USD", status: "em_analise" }).data?.status).toBe("em_analise");
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
  it("datas precisam existir no calendário e valores respeitam os limites do banco (numeric)", () => {
    const i = { projeto_id: uuid, item: "Barcaças", categoria: "logistica", quantidade: "4", valor_unitario: "250000", data: "2026-01-20" };
    expect(investimentoSchema.safeParse({ ...i, data: "2026-02-30" }).error?.issues[0].message).toBe("Informe uma data válida.");
    expect(investimentoSchema.safeParse({ ...i, data: "2026-13-01" }).success).toBe(false);
    expect(investimentoSchema.safeParse({ ...i, data: "2028-02-29" }).success).toBe(true);
    expect(investimentoSchema.safeParse({ ...i, valor_unitario: "1e14" }).error?.issues[0].message).toBe("Valor unitário é grande demais.");
    expect(investimentoSchema.safeParse({ ...i, quantidade: "Infinity" }).success).toBe(false);
    expect(investimentoSchema.safeParse({ ...i, projeto_id: "abc" }).error?.issues[0].message).toBe("Identificador inválido.");
    expect(projetoSchema.safeParse({ nome: "P", data_inicio: "2026-01-01", moeda: "USD", tipo_parceria: "investidor", participacao_pct: "10", descricao: "x".repeat(2001) })
      .error?.issues[0].message).toBe("Descrição muito longa (máx. 2000 caracteres).");
  });
  it("membro: e-mail normalizado para minúsculas e papel dentro do enum", () => {
    const { membro } = criarSchemas(obterDicionario("pt"));
    const base = { projeto_id: uuid, email: "  Socio@Empresa.COM ", papel: "manager" };
    expect(membro.safeParse(base).data).toEqual({ projeto_id: uuid, email: "socio@empresa.com", papel: "manager" });
    expect(membro.safeParse({ ...base, email: "sem-arroba" }).error?.issues[0].message).toBe("Informe um e-mail válido.");
    // "dono" não é papel de membro: quem cria o projeto já é o dono
    expect(membro.safeParse({ ...base, papel: "dono" }).error?.issues[0].message).toBe("Papel inválido.");
    expect(membro.safeParse({ ...base, papel: "editor" }).success).toBe(false);
    expect(membro.safeParse({ ...base, projeto_id: "x" }).success).toBe(false);
  });
  it("redirecionamento pós-login só aceita caminho interno", () => {
    expect(caminhoInterno("/projetos/abc")).toBe("/projetos/abc");
    // O padrão virou /painel (o ADM entra no painel da empresa); o que este
    // teste guarda é que caminho EXTERNO nunca passa.
    expect(caminhoInterno("//evil.com")).toBe("/painel");
    expect(caminhoInterno("/\\evil.com")).toBe("/painel");
    expect(caminhoInterno("https://evil.com")).toBe("/painel");
    expect(caminhoInterno(null)).toBe("/painel");
  });
  it("participante: percentual > 0 e <= 100", () => {
    const p = { projeto_id: uuid, nome: "Fundo Y", tipo: "investidor", percentual: "25" };
    expect(participanteSchema.safeParse(p).success).toBe(true);
    expect(participanteSchema.safeParse({ ...p, percentual: "0" }).success).toBe(false);
    expect(participanteSchema.safeParse({ ...p, tipo: "gerente" }).success).toBe(false);
  });
});

describe("Permissões por papel", () => {
  it("dono e admin mandam em tudo", () => {
    for (const papel of ["dono", "admin"] as const) {
      expect(permissoes(papel)).toMatchObject({
        verInvestimentos: true, lancar: true, alterar: true, alterarComPin: false, administrar: true,
      });
    }
    expect(permissoes("dono").ehDono).toBe(true);
    expect(permissoes("admin").ehDono).toBe(false);
  });
  it("manager vê e corrige entradas e saídas, mas não enxerga investimentos", () => {
    expect(permissoes("manager")).toEqual({
      verInvestimentos: false, lancar: true, alterar: true, alterarComPin: false, administrar: false, ehDono: false, ehInvestidor: false,
    });
  });
  it("escritório só lança; alterar e excluir dependem do PIN", () => {
    expect(permissoes("escritorio")).toEqual({
      verInvestimentos: false, lancar: true, alterar: false, alterarComPin: true, administrar: false, ehDono: false, ehInvestidor: false,
    });
  });
  it("sem papel não faz nada", () => {
    expect(permissoes(null)).toEqual({
      verInvestimentos: false, lancar: false, alterar: false, alterarComPin: false, administrar: false, ehDono: false, ehInvestidor: false,
    });
  });
  it("só o escritório passa pelo caminho do PIN", () => {
    const comPin = (["dono", "admin", "manager", "escritorio", null] as const).filter((p) => permissoes(p).alterarComPin);
    expect(comPin).toEqual(["escritorio"]);
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
  it("hojeISO usa o dia local, não o dia em UTC", () => {
    // 22:30 local no Brasil (UTC−3) já é 01:30 do dia seguinte em UTC
    const noite = new Date(2026, 8, 22, 22, 30);
    expect(hojeISO(noite)).toBe("2026-09-22");
    expect(hojeISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("0007 — investidor e aportes", () => {
  it("investidor só lê: nada de lançar, alterar, administrar ou ver investimentos", () => {
    expect(permissoes("investidor")).toEqual({
      verInvestimentos: false, lancar: false, alterar: false, alterarComPin: false, administrar: false, ehDono: false, ehInvestidor: true,
    });
  });
  it("resumoAportes soma por participante e calcula a % implícita vs pactuada", () => {
    const participantes = [
      { id: "a", nome: "Fundo Alfa", percentual: 30 },
      { id: "b", nome: "Mineradora B", percentual: 30 },
      { id: "c", nome: "Sem aporte", percentual: 10 },
    ];
    const aportes = [
      { participante_id: "a", valor: 300000 }, { participante_id: "b", valor: 250000 }, { participante_id: "b", valor: 100000 },
    ];
    const r = resumoAportes(participantes, aportes);
    expect(r.total).toBe(650000);
    expect(r.linhas[0]).toMatchObject({ aportado: 300000, pactuada: 30, implicita: 46.15, diferenca: 16.15 });
    expect(r.linhas[1]).toMatchObject({ aportado: 350000, implicita: 53.85, diferenca: 23.85 });
    expect(r.linhas[2]).toMatchObject({ aportado: 0, implicita: 0, diferenca: -10 });
    expect(resumoAportes(participantes, []).linhas[0].implicita).toBeNull();
  });
});
