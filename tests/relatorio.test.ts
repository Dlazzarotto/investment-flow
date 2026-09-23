import { describe, expect, it } from "vitest";
import { esc, montarRelatorio } from "@/lib/relatorio";
import { obterDicionario } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { FluxoMensal, Projeto } from "@/lib/types";
import type { Kpis, Rateio } from "@/lib/calculos";

const projeto = {
  id: "p1", owner_id: "u1", nome: "Minério Bolívia", descricao: null, data_inicio: "2026-01-15",
  moeda: "USD", tipo_parceria: "joint_venture", participacao_pct: 40, organizacao_id: "o1",
  criado_em: "", atualizado_em: "",
} as Projeto;

const kpis: Kpis = {
  investimentoTotal: 1_240_000, custoVendasTotal: 310_000, despesasTotal: 90_000,
  saidaTotal: 1_640_000, receitaTotal: 980_000, margemBruta: 670_000, margemPct: 0.6837,
  saldo: -660_000, roi: -0.5323,
} as Kpis;

const rateios: Rateio[] = [
  { tipo: "dono", nome: "", percentual: 40, investimentoAtribuivel: 496_000,
    receitaAtribuivel: 392_000, saldoAtribuivel: -264_000 } as Rateio,
];

const fluxo: FluxoMensal[] = [
  { mes: "2026-01-01", investimento: 400_000, custo_vendas: 0, despesas: 10_000, saida: 410_000,
    receita: 0, saida_acumulada: 410_000, rec_acumulada: 0, saldo_acumulado: -410_000 },
];

function montar(nome: string, locale: "pt" | "en" | "zh" = "pt") {
  const d = obterDicionario(locale);
  return montarRelatorio({
    projeto: { ...projeto, nome }, empresa: "Peace on Tax Trading", kpis, rateios,
    nomeParte: () => d.parceria.voce, papel: () => d.enums.tipoParceria.joint_venture,
    fluxo, breakeven: null, geradoEm: "2026-09-23", d, f: formatadores(locale), lang: locale,
  });
}

describe("Escape do relatório", () => {
  it("escapa os cinco caracteres que quebram HTML", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
  it("null e undefined viram string vazia, não a palavra 'null'", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("nome de projeto com script NÃO sai cru — o relatório abre no navegador do usuário", () => {
    const html = montar('<script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("aspas no nome não escapam do atributo title nem do texto", () => {
    const html = montar('Lote "A" & Cia');
    expect(html).toContain("Lote &quot;A&quot; &amp; Cia");
  });
});

describe("Conteúdo do relatório", () => {
  const html = montar("Minério Bolívia");

  it("traz os números do resumo, não a lista de lançamentos", () => {
    // Resumo é para pessoa ler; a lista crua é o CSV.
    expect(html).toContain("Investimento total");
    expect(html).toContain("Saldo de caixa");
    expect(html).toContain("Break-even");
    expect(html).toContain("não atingido");
  });

  it("declara o idioma no html e imprime sozinho", () => {
    expect(html).toContain('<html lang="pt"');
    expect(html).toContain("window.print()");
  });

  it("sai no idioma pedido", () => {
    // exportacao.investimentoTotal, nao a chave homonima do dashboard.
    expect(montar("x", "en")).toContain("Total investment");
    expect(montar("x", "zh")).toContain("投资总额");
  });

  it("o botão de imprimir some na impressão — senão sairia dentro do PDF", () => {
    expect(html).toContain("@media print { .acao { display: none; }");
  });
});
