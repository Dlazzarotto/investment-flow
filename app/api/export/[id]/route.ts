import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { listarInvestimentos, listarParticipantes, listarVendas, mapaUltimasEstimativas, obterFluxoMensal, obterProjeto } from "@/lib/consultas";
import { calcularKpis, desvioVsMedia, encontrarBreakeven, normalizarItem, ratearParticipacoes, type Rateio, type TipoRateio } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { montarCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** GET /api/export/[id]?formato=csv|xlsx — exporta os dados do projeto no idioma atual (RLS garante o dono). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const x = d.exportacao;
  const formato = req.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const projeto = await obterProjeto(params.id);
  const [investimentos, vendas, participantes, fluxo, estimativas] = await Promise.all([
    listarInvestimentos(projeto.id), listarVendas(projeto.id), listarParticipantes(projeto.id),
    obterFluxoMensal(projeto.id), mapaUltimasEstimativas(projeto.id),
  ]);
  const kpis = calcularKpis(investimentos, vendas);
  const slug = projeto.nome.normalize("NFD").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "projeto";
  const papel = (tipo: TipoRateio) => tipo === "dono" ? d.enums.tipoParceria[projeto.tipo_parceria]
    : tipo === "restante" ? "—" : d.enums.tipoParticipante[tipo];
  const nomeParte = (r: Rateio) => r.tipo === "dono" ? d.parceria.voce : r.tipo === "restante" ? d.dashboard.naoAlocado : r.nome;

  if (formato === "csv") {
    const linhas: (string | number)[][] = [
      [x.tipo, x.id, x.data, x.descricao, x.categoria, x.quantidade, x.unidade, x.precoUnitario, x.valor],
      ...investimentos.map((i) => [x.tipoInvestimento, i.id, i.data, i.item, d.enums.categoriaInvestimento[i.categoria],
        Number(i.quantidade), "", Number(i.valor_unitario), Number(i.valor_total)]),
      ...vendas.map((v) => [x.tipoReceita, v.id, v.data, x.venda, d.enums.categoriaReceita[v.categoria],
        Number(v.volume), v.unidade, Number(v.preco_unitario), Number(v.receita_total)]),
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
    [x.investimentoTotal, kpis.investimentoTotal], [x.receitaTotal, kpis.receitaTotal], [x.saldo, kpis.saldo],
    [x.roi, kpis.roi === null ? "—" : Math.round(kpis.roi * 10000) / 100], [x.breakeven, breakeven ?? x.naoAtingido],
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
  ];
  for (const v of vendas) {
    ven.addRow({ data: v.data, categoria: d.enums.categoriaReceita[v.categoria], vol: Number(v.volume),
      un: v.unidade, preco: Number(v.preco_unitario), total: Number(v.receita_total) });
  }

  const fx = wb.addWorksheet(x.fluxoMensal);
  fx.columns = [
    { header: x.mes, key: "mes", width: 10 }, { header: x.investimento, key: "i", width: 16 },
    { header: x.receitaMes, key: "r", width: 16 }, { header: x.invAcum, key: "ia", width: 16 },
    { header: x.recAcum, key: "ra", width: 16 }, { header: x.saldoAcum, key: "s", width: 16 },
  ];
  for (const f of fluxo) fx.addRow({ mes: f.mes.slice(0, 7), i: f.investimento, r: f.receita, ia: f.inv_acumulado, ra: f.rec_acumulada, s: f.saldo_acumulado });

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
