"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { FluxoMensal, Moeda } from "@/lib/types";

const NAVY = "#2D3278", ORANGE = "#F47B20";

/** Gráfico 1 — Investimentos vs Receitas por mês. */
export function GraficoFluxo({ fluxo, moeda }: { fluxo: FluxoMensal[]; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = fluxo.map((x) => ({ ...x, rotulo: f.mesCurto(x.mes) }));
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#E4E5EC" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 14 }} tickLine={false} axisLine={{ stroke: "#D9DBE4" }} />
          <YAxis tick={{ fontSize: 13 }} tickLine={false} axisLine={false} width={64}
                 tickFormatter={(v) => f.moeda(Number(v), moeda, true)} />
          <Tooltip formatter={(v: number, nome: string) => [f.moeda(v, moeda), nome]}
                   labelFormatter={(l) => String(l)} contentStyle={{ fontSize: 15 }} />
          <Legend wrapperStyle={{ fontSize: 15 }} />
          <Bar dataKey="investimento" name={d.dashboard.serieInvestimentos} fill={ORANGE} radius={[3, 3, 0, 0]} />
          <Bar dataKey="receita" name={d.dashboard.serieReceitas} fill={NAVY} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
