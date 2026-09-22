"use client";
import { useMemo, useState } from "react";
import { AJUSTE_PADRAO, simularCenarios } from "@/lib/calculos";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { FluxoMensal, Moeda } from "@/lib/types";

/** Limite dos campos de variação: acima disso o cenário deixa de dizer algo sobre o projeto. */
const MAX_PCT = 100;

/**
 * Sensibilidade sobre o fluxo real. Os cálculos são puros (lib/calculos.ts), então
 * mexer nos percentuais recalcula na hora, sem ida ao servidor.
 */
export function Cenarios({ fluxo, moeda }: { fluxo: FluxoMensal[]; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.dashboard;
  const [receita, setReceita] = useState(AJUSTE_PADRAO.receita * 100);
  const [investimento, setInvestimento] = useState(AJUSTE_PADRAO.investimento * 100);

  // Os campos já chegam limitados; o clamp aqui protege de um valor inesperado.
  const cenarios = useMemo(
    () => simularCenarios(fluxo, { receita: limitar(receita) / 100, investimento: limitar(investimento) / 100 }),
    [fluxo, receita, investimento],
  );

  return (
    <>
      <p className="mb-4 text-stone">{t.cenariosTexto}</p>
      <div className="mb-6 grid gap-4 sm:max-w-lg sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="ajuste_receita">{t.ajusteReceita}</label>
          <input id="ajuste_receita" type="number" inputMode="decimal" min={0} max={MAX_PCT} step="1"
                 className="campo num" value={receita} onChange={(e) => setReceita(limitar(Number(e.target.value)))} />
        </div>
        <div>
          <label className="rotulo" htmlFor="ajuste_investimento">{t.ajusteInvestimento}</label>
          <input id="ajuste_investimento" type="number" inputMode="decimal" min={0} max={MAX_PCT} step="1"
                 className="campo num" value={investimento} onChange={(e) => setInvestimento(limitar(Number(e.target.value)))} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>{t.cenario}</th><th className="num">{t.invAcum}</th><th className="num">{t.recAcum}</th>
              <th className="num">{t.saldoAcum}</th><th className="num">{t.roi}</th>
              <th className="num">{t.roiAnualizado}</th><th className="num">{t.tir}</th><th>{t.breakeven}</th>
            </tr>
          </thead>
          <tbody>
            {cenarios.map((c) => (
              <tr key={c.cenario} className={c.cenario === "base" ? "bg-navy-soft/50" : ""}>
                <td className="font-medium">
                  {d.enums.cenario[c.cenario]}
                  {c.cenario !== "base" && (
                    <span className="block text-stone">
                      {fmtTexto(t.premissaCenario, { receita: f.numero(c.fatorReceita, 2), investimento: f.numero(c.fatorInvestimento, 2) })}
                    </span>
                  )}
                </td>
                <td className="num">{f.moeda(c.investimentoTotal, moeda)}</td>
                <td className="num">{f.moeda(c.receitaTotal, moeda)}</td>
                <td className={`num font-semibold ${c.saldo < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(c.saldo, moeda)}</td>
                <td className="num">{f.pct(c.roi)}</td>
                <td className="num">{f.pct(c.roiAnualizado)}</td>
                <td className="num">{f.pct(c.tirAnual)}</td>
                <td className="whitespace-nowrap">{c.breakeven ? f.mesLongo(c.breakeven) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function limitar(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(Math.max(pct, 0), MAX_PCT);
}
