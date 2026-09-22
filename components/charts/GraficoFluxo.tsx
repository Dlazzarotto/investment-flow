"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { FluxoMensal, Moeda } from "@/lib/types";
import { EIXO, ESPACO_ROTULO, ESTILO_LEGENDA, ESTILO_TOOLTIP, GRADE, LARGURA_EIXO_Y, MARGEM, NAVY, ORANGE, TICK } from "./estilo";

/** Gráfico 1 — Investimentos vs Receitas por mês. */
export function GraficoFluxo({ fluxo, moeda }: { fluxo: FluxoMensal[]; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = fluxo.map((x) => ({ ...x, rotulo: f.mesCurto(x.mes) }));
  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer>
        <BarChart data={dados} margin={MARGEM} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={TICK} tickLine={false} axisLine={{ stroke: EIXO }}
                 interval="preserveStartEnd" minTickGap={ESPACO_ROTULO} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={LARGURA_EIXO_Y}
                 tickFormatter={(v) => f.moeda(Number(v), moeda, true)} />
          <Tooltip formatter={(v: number, nome: string) => [f.moeda(v, moeda), nome]}
                   labelFormatter={(l) => String(l)} contentStyle={ESTILO_TOOLTIP} />
          <Legend wrapperStyle={ESTILO_LEGENDA} />
          <Bar dataKey="investimento" name={d.dashboard.serieInvestimentos} fill={ORANGE} radius={[3, 3, 0, 0]} />
          <Bar dataKey="receita" name={d.dashboard.serieReceitas} fill={NAVY} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
