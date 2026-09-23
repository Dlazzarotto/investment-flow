/**
 * Relatório do projeto em HTML, pronto para o navegador salvar em PDF.
 *
 * Por que HTML e não uma biblioteca de PDF: o sistema fala quatro idiomas, e um
 * gerador de PDF precisaria embutir uma fonte CJK de vários megabytes para o
 * chinês não sair em quadradinhos. O navegador já tem as fontes de todos os
 * idiomas instaladas — e ainda deixa o usuário escolher tamanho de página.
 *
 * O conteúdo é DIFERENTE do CSV de propósito: CSV é lista crua para outro
 * sistema ler; isto é um resumo para uma pessoa ler.
 */
import type { Dicionario } from "@/lib/i18n";
import type { Formatadores } from "@/lib/format";
import type { FluxoMensal, Projeto } from "@/lib/types";
import type { Kpis, Rateio } from "@/lib/calculos";

/** Texto vindo do banco nunca entra cru no HTML. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

interface Entrada {
  projeto: Projeto;
  empresa: string | null;
  kpis: Kpis;
  rateios: Rateio[];
  nomeParte: (r: Rateio) => string;
  papel: (r: Rateio) => string;
  fluxo: FluxoMensal[];
  breakeven: string | null;
  geradoEm: string;
  d: Dicionario;
  f: Formatadores;
  lang: string;
}

export function montarRelatorio(e: Entrada): string {
  const { projeto: p, kpis, d, f } = e;
  const x = d.exportacao;
  const m = p.moeda;

  const linha = (rotulo: string, valor: string, forte = false) =>
    `<tr><th>${esc(rotulo)}</th><td class="num${forte ? " forte" : ""}">${esc(valor)}</td></tr>`;

  const resumo = [
    linha(x.investimentoTotal, f.moeda(kpis.investimentoTotal, m)),
    linha(x.custoVendas, f.moeda(kpis.custoVendasTotal, m)),
    linha(x.despesas, f.moeda(kpis.despesasTotal, m)),
    linha(x.saidaTotal, f.moeda(kpis.saidaTotal, m), true),
    linha(x.receitaTotal, f.moeda(kpis.receitaTotal, m), true),
    linha(x.margem, `${f.moeda(kpis.margemBruta, m)} · ${f.pct(kpis.margemPct)}`),
    linha(x.saldo, f.moeda(kpis.saldo, m), true),
    linha(x.roi, f.pct(kpis.roi)),
    linha(x.breakeven, e.breakeven ? f.mesLongo(e.breakeven) : x.naoAtingido),
  ].join("");

  const participacao = e.rateios.length === 0 ? "" : `
    <h2>${esc(x.participacao)}</h2>
    <table class="larga">
      <thead><tr>
        <th>${esc(x.parte)}</th><th>${esc(x.papel)}</th>
        <th class="num">${esc(x.participacaoPct)}</th><th class="num">${esc(x.saldoAtrib)}</th>
      </tr></thead>
      <tbody>${e.rateios.map((r) => `<tr>
        <td>${esc(e.nomeParte(r))}</td><td>${esc(e.papel(r))}</td>
        <td class="num">${esc(f.pct(r.percentual / 100))}</td>
        <td class="num">${esc(f.moeda(r.saldoAtribuivel, m))}</td>
      </tr>`).join("")}</tbody>
    </table>`;

  const fluxo = e.fluxo.length === 0 ? "" : `
    <h2>${esc(d.dashboard.tabelaMensal)}</h2>
    <table class="larga">
      <thead><tr>
        <th>${esc(x.mes)}</th><th class="num">${esc(x.saida)}</th>
        <th class="num">${esc(x.receitaMes)}</th><th class="num">${esc(x.saldoAcum)}</th>
      </tr></thead>
      <tbody>${e.fluxo.map((l) => `<tr>
        <td>${esc(f.mesCurto(l.mes))}</td>
        <td class="num">${esc(f.moeda(Number(l.saida), m))}</td>
        <td class="num">${esc(f.moeda(Number(l.receita), m))}</td>
        <td class="num">${esc(f.moeda(Number(l.saldo_acumulado), m))}</td>
      </tr>`).join("")}</tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="${esc(e.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.nome)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
         color: #1B1C23; font-size: 12pt; line-height: 1.45; }
  header { display: flex; align-items: flex-start; gap: 16px; border-bottom: 3px solid #2D3278; padding-bottom: 12px; }
  header img { width: 96px; height: auto; }
  h1 { margin: 0; font-size: 20pt; color: #2D3278; }
  .sub { margin: 2px 0 0; color: #6B6F80; font-size: 11pt; }
  h2 { margin: 22px 0 8px; font-size: 13pt; color: #2D3278; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  table.larga { table-layout: fixed; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #D9DBE4; text-align: left; vertical-align: top; }
  thead th { border-bottom: 2px solid #2D3278; color: #2D3278; font-size: 10pt; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .forte { font-weight: 700; color: #2D3278; }
  tbody tr { page-break-inside: avoid; }
  footer { margin-top: 26px; border-top: 1px solid #D9DBE4; padding-top: 8px;
           color: #6B6F80; font-size: 9pt; }
  .acao { margin: 0 0 18px; }
  .acao button { min-height: 44px; padding: 0 20px; border: 0; border-radius: 6px;
                 background: #F47B20; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  @media print { .acao { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<p class="acao"><button type="button" onclick="window.print()">${esc(d.dashboard.baixarPdf)}</button></p>
<header>
  <img src="/logo.png" alt="">
  <div>
    <h1>${esc(p.nome)}</h1>
    <p class="sub">${esc([e.empresa, d.enums.tipoParceria[p.tipo_parceria], p.moeda].filter(Boolean).join(" · "))}</p>
    <p class="sub">${esc(x.dataInicio)}: ${esc(f.data(p.data_inicio))}</p>
  </div>
</header>

<h2>${esc(x.resumo)}</h2>
<table>${resumo}</table>
${participacao}
${fluxo}

<footer>${esc(d.meta.titulo)} · ${esc(e.geradoEm)}</footer>
<script>
  // Abre o diálogo de impressão assim que a página e a logo carregarem: o
  // usuário clicou em "baixar PDF", não em "ver relatório".
  window.addEventListener("load", function () { window.print(); });
</script>
</body>
</html>`;
}
