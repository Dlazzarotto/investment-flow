"use client";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import type { FluxoMensal, Moeda } from "@/lib/types";
import {
  EIXO, ESPACO_ROTULO, ESTILO_LEGENDA, ESTILO_TOOLTIP, FONTE, GAIN, GRADE, LARGURA_EIXO_Y, MARGEM, NAVY, ORANGE, TICK,
} from "./estilo";

/** Gráfico 2 — acumulados com a linha do break-even. */
export function GraficoBreakeven({ fluxo, moeda, breakeven }:
  { fluxo: FluxoMensal[]; moeda: Moeda; breakeven: string | null }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = fluxo.map((x) => ({ ...x, rotulo: f.mesCurto(x.mes) }));
  const rotuloBe = breakeven ? f.mesCurto(breakeven) : null;
  return (
    <div className="h-96 w-full sm:h-[28rem]">
      <ResponsiveContainer>
        <ComposedChart data={dados} margin={{ ...MARGEM, top: 28 }}>
          <defs>
            <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={TICK} tickLine={false} axisLine={{ stroke: EIXO }}
                 interval="preserveStartEnd" minTickGap={ESPACO_ROTULO} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={LARGURA_EIXO_Y}
                 tickFormatter={(v) => f.moeda(Number(v), moeda, true)} />
          <Tooltip formatter={(v: number, nome: string) => [f.moeda(v, moeda), nome]} contentStyle={ESTILO_TOOLTIP} />
          <Legend wrapperStyle={ESTILO_LEGENDA} />
          <Area type="monotone" dataKey="rec_acumulada" name={d.dashboard.serieReceitaAcum} stroke={NAVY} strokeWidth={3}
                fill="url(#gRec)" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="inv_acumulado" name={d.dashboard.serieCusto} stroke={ORANGE} strokeWidth={3} dot={{ r: 3 }} />
          {rotuloBe && (
            <ReferenceLine x={rotuloBe} stroke={GAIN} strokeWidth={2} strokeDasharray="6 4"
                           label={{ value: fmtTexto(d.dashboard.breakevenRotulo, { mes: rotuloBe }), position: "top", fill: GAIN, fontSize: FONTE }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
