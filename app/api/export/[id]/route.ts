import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import {
  listarAportes, listarDespesas, listarInvestimentos, listarParticipantes, listarVendas, mapaUltimasEstimativas,
  obterFluxoMensal, obterProjeto,
} from "@/lib/consultas";
import {
  calcularKpis, desvioVsMedia, detalharCustoVenda, encontrarBreakeven, normalizarItem, ratearParticipacoes,
  roiAnualizado, simularCenarios, tirAnual, type Rateio, type TipoRateio,
} from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { montarCsv } from "@/lib/csv";
import { montarRelatorio } from "@/lib/relatorio";
import { formatadores } from "@/lib/format";
import { minhaOrganizacao } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/[id]?formato=csv|xlsx|pdf — exporta no idioma atual (o RLS
 * garante quem pode). CSV e XLSX são listas para outro sistema ler; PDF é um
 * relatório para uma pessoa ler, e por isso traz resumo, não lançamento a
 * lançamento.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const x = d.exportacao;
  const pedido = req.nextUrl.searchParams.get("formato");
  const formato = pedido === "xlsx" || pedido === "pdf" ? pedido : "csv";
  const projeto = await obterProjeto(params.id);
  const aportes = await listarAportes(projeto.id);
  const [investimentos, vendas, despesas, participantes, fluxo, estimativas] = await Promise.all([
    listarInvestimentos(projeto.id), listarVendas(projeto.id), listarDespesas(projeto.id),
    listarParticipantes(projeto.id), obterFluxoMensal(projeto.id), mapaUltimasEstimativas(projeto.id),
  ]);
  const kpis = calcularKpis(investimentos, vendas, despesas);
  const slug = projeto.nome.normalize("NFD").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "projeto";
  const papel = (tipo: TipoRateio) => tipo === "dono" ? d.enums.tipoParceria[projeto.tipo_parceria]
    : tipo === "restante" ? "—" : d.enums.tipoParticipante[tipo];
  const nomeParte = (r: Rateio) => r.tipo === "dono" ? d.parceria.voce : r.tipo === "restante" ? d.dashboard.naoAlocado : r.nome;

  if (formato === "pdf") {
    const [org, fluxoPdf] = await Promise.all([minhaOrganizacao(), Promise.resolve(fluxo)]);
    const html = montarRelatorio({
      projeto, empresa: org?.organizacao.nome ?? null, kpis,
      rateios: ratearParticipacoes(projeto, participantes, kpis),
      nomeParte, papel: (r) => papel(r.tipo), fluxo: fluxoPdf,
      breakeven: encontrarBreakeven(fluxoPdf), geradoEm: new Date().toISOString().slice(0, 10),
      d, f: formatadores(locale), lang: locale === "pt" ? "pt-BR" : locale === "zh" ? "zh-CN" : locale,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (formato === "csv") {
    const linhas: (string | number)[][] = [
      [x.tipo, x.id, x.data, x.descricao, x.categoria, x.quantidade, x.unidade, x.precoUnitario, x.valor, x.custoTotal, x.margem],
      ...investimentos.map((i) => [x.tipoInvestimento, i.id, i.data, i.item, d.enums.categoriaInvestimento[i.categoria],
        Number(i.quantidade), "", Number(i.valor_unitario), -Number(i.valor_total), "", ""]),
      ...vendas.map((v) => [x.tipoReceita, v.id, v.data, x.venda, d.enums.categoriaReceita[v.categoria],
        Number(v.volume), v.unidade, Number(v.preco_unitario), Number(v.receita_total),
        Number(v.custo_total ?? 0), detalharCustoVenda(v).margem]),
      ...despesas.map((y) => [x.tipoDespesa, y.id, y.data, y.descricao, d.enums.categoriaDespesa[y.categoria],
        "", "", "", -Number(y.valor), "", ""]),
    ];
    return new NextResponse(montarCsv(linhas, locale), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}_dados.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = d.meta.titulo;
  const breakeven = encontrarBreakeven(fluxo);

  const resumo = wb.addWorksheet(x.resumo);
  resumo.columns = [{ header: x.indicador, key: "k", width: 34 }, { header: x.valor, key: "v", width: 28 }];
  resumo.addRows([
    [x.projeto, projeto.nome], [x.moeda, projeto.moeda], [x.dataInicio, projeto.data_inicio],
    [x.tipoParceria, d.enums.tipoParceria[projeto.tipo_parceria]], [x.suaParticipacao, Number(projeto.participacao_pct)],
    [x.investimentoTotal, kpis.investimentoTotal], [x.custoVendas, kpis.custoVendasTotal],
    [x.despesas, kpis.despesasTotal], [x.saidaTotal, kpis.saidaTotal],
    [x.receitaTotal, kpis.receitaTotal], [x.margem, kpis.margemBruta], [x.margemPct, pctExcel(kpis.margemPct)],
    [x.saldo, kpis.saldo],
    [x.roi, pctExcel(kpis.roi)], [x.roiAnualizado, pctExcel(roiAnualizado(kpis.roi, fluxo.length))],
    [x.tirAnual, pctExcel(tirAnual(fluxo.map((m) => m.receita - m.investimento)))],
    [x.breakeven, breakeven ?? x.naoAtingido],
  ]);

  const part = wb.addWorksheet(x.participacao);
  part.columns = [
    { header: x.parte, key: "nome", width: 30 }, { header: x.papel, key: "tipo", width: 20 },
    { header: x.participacaoPct, key: "pct", width: 18 }, { header: x.invAtrib, key: "inv", width: 24 },
    { header: x.recAtrib, key: "rec", width: 22 }, { header: x.saldoAtrib, key: "saldo", width: 20 },
  ];
  for (const r of ratearParticipacoes(projeto, participantes, kpis)) {
    part.addRow({ nome: nomeParte(r),
      tipo: papel(r.tipo), pct: r.percentual, inv: r.investimentoAtribuivel, rec: r.receitaAtribuivel, saldo: r.saldoAtribuivel });
  }

  const apo = wb.addWorksheet(x.aportes);
  apo.columns = [
    { header: x.data, key: "data", width: 12 }, { header: x.participante, key: "participante", width: 30 },
    { header: x.tipoAporte, key: "tipo", width: 24 }, { header: x.descricao, key: "descricao", width: 40 },
    { header: x.valor, key: "valor", width: 16 }, { header: x.observacoes, key: "obs", width: 40 },
  ];
  const nomeParticipante = new Map(participantes.map((p) => [p.id, p.nome]));
  for (const a of aportes) {
    apo.addRow({ data: a.data, participante: nomeParticipante.get(a.participante_id) ?? "", tipo: d.enums.tipoAporte[a.tipo],
      descricao: a.descricao, valor: Number(a.valor), obs: a.observacoes ?? "" });
  }

  const inv = wb.addWorksheet(x.investimentos);
  inv.columns = [
    { header: x.data, key: "data", width: 12 }, { header: x.item, key: "item", width: 34 },
    { header: x.categoria, key: "categoria", width: 18 }, { header: x.quantidade, key: "qtd", width: 12 },
    { header: x.valorUnitario, key: "unit", width: 16 }, { header: x.valorTotal, key: "total", width: 16 },
    { header: x.mediaIA, key: "media", width: 22 }, { header: x.desvio, key: "desvio", width: 20 },
  ];
  for (const i of investimentos) {
    const est = estimativas.get(normalizarItem(i.item));
    const desvio = est ? desvioVsMedia(Number(i.valor_unitario), Number(est.valor_medio)) : null;
    inv.addRow({ data: i.data, item: i.item, categoria: d.enums.categoriaInvestimento[i.categoria],
      qtd: Number(i.quantidade), unit: Number(i.valor_unitario), total: Number(i.valor_total),
      media: est ? Number(est.valor_medio) : "", desvio: desvio === null ? "" : Math.round(desvio * 10000) / 100 });
  }

  const ven = wb.addWorksheet(x.vendas);
  ven.columns = [
    { header: x.data, key: "data", width: 12 }, { header: x.categoria, key: "categoria", width: 20 },
    { header: x.volume, key: "vol", width: 12 }, { header: x.unidade, key: "un", width: 12 },
    { header: x.precoUnitario, key: "preco", width: 16 }, { header: x.receita, key: "total", width: 16 },
    { header: x.custoUnitario, key: "cu", width: 16 }, { header: x.freteUnitario, key: "fu", width: 16 },
    { header: x.impostosPct, key: "ip", width: 14 }, { header: x.comissaoPct, key: "cp", width: 14 },
    { header: x.custoTotal, key: "ct", width: 16 }, { header: x.margem, key: "mg", width: 16 },
    { header: x.margemPct, key: "mp", width: 14 },
  ];
  for (const v of vendas) {
    const custo = detalharCustoVenda(v);
    ven.addRow({ data: v.data, categoria: d.enums.categoriaReceita[v.categoria], vol: Number(v.volume),
      un: v.unidade, preco: Number(v.preco_unitario), total: Number(v.receita_total),
      cu: Number(v.custo_unitario ?? 0), fu: Number(v.frete_unitario ?? 0),
      ip: Number(v.impostos_pct ?? 0), cp: Number(v.comissao_pct ?? 0),
      ct: custo.total, mg: custo.margem, mp: pctExcel(custo.margemPct) });
  }

  const desp = wb.addWorksheet(x.despesas);
  desp.columns = [
    { header: x.data, key: "data", width: 12 }, { header: x.descricao, key: "desc", width: 40 },
    { header: x.categoria, key: "categoria", width: 20 }, { header: x.valor, key: "valor", width: 16 },
  ];
  for (const y of despesas) {
    desp.addRow({ data: y.data, desc: y.descricao, categoria: d.enums.categoriaDespesa[y.categoria], valor: Number(y.valor) });
  }

  const fx = wb.addWorksheet(x.fluxoMensal);
  fx.columns = [
    { header: x.mes, key: "mes", width: 10 }, { header: x.investimento, key: "i", width: 16 },
    { header: x.custoVendas, key: "c", width: 18 }, { header: x.despesas, key: "d", width: 16 },
    { header: x.saida, key: "sa", width: 16 }, { header: x.receitaMes, key: "r", width: 16 },
    { header: x.saidaAcum, key: "saa", width: 18 }, { header: x.recAcum, key: "ra", width: 16 },
    { header: x.saldoAcum, key: "s", width: 16 },
  ];
  for (const f of fluxo) {
    fx.addRow({ mes: f.mes.slice(0, 7), i: f.investimento, c: f.custo_vendas, d: f.despesas, sa: f.saida,
      r: f.receita, saa: f.saida_acumulada, ra: f.rec_acumulada, s: f.saldo_acumulado });
  }

  const cen = wb.addWorksheet(x.cenarios);
  cen.columns = [
    { header: x.cenario, key: "nome", width: 20 }, { header: x.fatorReceita, key: "fr", width: 16 },
    { header: x.fatorInvestimento, key: "fi", width: 18 }, { header: x.saidaTotal, key: "inv", width: 22 },
    { header: x.receitaTotal, key: "rec", width: 20 }, { header: x.saldo, key: "saldo", width: 18 },
    { header: x.roi, key: "roi", width: 16 }, { header: x.roiAnualizado, key: "roiAno", width: 20 },
    { header: x.tirAnual, key: "tir", width: 18 }, { header: x.breakeven, key: "be", width: 14 },
  ];
  for (const c of simularCenarios(fluxo)) {
    cen.addRow({ nome: d.enums.cenario[c.cenario], fr: c.fatorReceita, fi: c.fatorInvestimento,
      inv: c.saidaTotal, rec: c.receitaTotal, saldo: c.saldo, roi: pctExcel(c.roi),
      roiAno: pctExcel(c.roiAnualizado), tir: pctExcel(c.tirAnual), be: c.breakeven ?? x.naoAtingido });
  }

  const est = wb.addWorksheet(x.estimativas);
  est.columns = [
    { header: x.item, key: "item", width: 34 }, { header: x.unidadeRef, key: "un", width: 16 },
    { header: x.minimo, key: "min", width: 16 }, { header: x.medio, key: "med", width: 16 }, { header: x.maximo, key: "max", width: 16 },
    { header: x.confianca, key: "conf", width: 14 }, { header: x.contexto, key: "ctx", width: 30 },
    { header: x.premissas, key: "prem", width: 60 }, { header: x.fontes, key: "fontes", width: 60 },
    { header: x.modelo, key: "modelo", width: 20 }, { header: x.data, key: "data", width: 12 },
  ];
  for (const e of estimativas.values()) {
    est.addRow({ item: e.item, un: e.unidade_ref, min: Number(e.valor_min), med: Number(e.valor_medio), max: Number(e.valor_max),
      conf: d.enums.confianca[e.confianca], ctx: e.contexto ?? "", prem: e.premissas.join(" | "),
      fontes: e.fontes.map((f) => `${f.titulo}: ${f.url}`).join(" | "), modelo: e.modelo, data: e.criado_em.slice(0, 10) });
  }

  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3278" } };
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "number") c.numFmt = "#,##0.00"; }));
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}_relatorio.xlsx"`,
    },
  });
}

/** Fração (0,25) vira percentual arredondado para a planilha (25); null vira travessão. */
function pctExcel(v: number | null): number | string {
  return v === null || !Number.isFinite(v) ? "—" : Math.round(v * 10000) / 100;
}
