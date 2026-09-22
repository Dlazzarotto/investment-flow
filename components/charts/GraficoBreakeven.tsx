"use client";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import type { FluxoMensal, Moeda } from "@/lib/types";

const NAVY = "#2D3278", ORANGE = "#F47B20";

/** Gráfico 2 — acumulados com a linha do break-even. */
export function GraficoBreakeven({ fluxo, moeda, breakeven }:
  { fluxo: FluxoMensal[]; moeda: Moeda; breakeven: string | null }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = fluxo.map((x) => ({ ...x, rotulo: f.mesCurto(x.mes) }));
  const rotuloBe = breakeven ? f.mesCurto(breakeven) : null;
  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer>
        <ComposedChart data={dados} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E4E5EC" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 14 }} tickLine={false} axisLine={{ stroke: "#D9DBE4" }} />
          <YAxis tick={{ fontSize: 13 }} tickLine={false} axisLine={false} width={64}
                 tickFormatter={(v) => f.moeda(Number(v), moeda, true)} />
          <Tooltip formatter={(v: number, nome: string) => [f.moeda(v, moeda), nome]} contentStyle={{ fontSize: 15 }} />
          <Legend wrapperStyle={{ fontSize: 15 }} />
          <Area type="monotone" dataKey="rec_acumulada" name={d.dashboard.serieReceitaAcum} stroke={NAVY} strokeWidth={3}
                fill="url(#gRec)" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="inv_acumulado" name={d.dashboard.serieCusto} stroke={ORANGE} strokeWidth={3} dot={{ r: 3 }} />
          {rotuloBe && (
            <ReferenceLine x={rotuloBe} stroke="#1B8A6B" strokeWidth={2} strokeDasharray="6 4"
                           label={{ value: fmtTexto(d.dashboard.breakevenRotulo, { mes: rotuloBe }), position: "top", fill: "#1B8A6B", fontSize: 14 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
