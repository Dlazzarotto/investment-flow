"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { CategoriaInvestimento, Moeda } from "@/lib/types";
import { CORES_CATEGORIA, ESTILO_LEGENDA, ESTILO_TOOLTIP, FONTE, TINTA } from "./estilo";

/** Gráfico 3 — distribuição dos investimentos por categoria. */
export function GraficoAlocacao({ alocacao, moeda }:
  { alocacao: { categoria: string; valor: number }[]; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = alocacao.map((a) => ({
    nome: d.enums.categoriaInvestimento[a.categoria as CategoriaInvestimento] ?? a.categoria,
    valor: a.valor,
  }));
  const total = dados.reduce((s, x) => s + x.valor, 0);
  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="48%" outerRadius="74%" paddingAngle={2}
               labelLine={false} isAnimationActive={false}
               // Rótulo da fatia em tinta, não na cor dela (a laranja da marca fica abaixo de 3:1 no fundo claro).
               label={({ percent, x, y, textAnchor }) => (
                 <text x={x} y={y} fill={TINTA} fontSize={FONTE} textAnchor={textAnchor} dominantBaseline="central">
                   {`${Math.round((percent ?? 0) * 100)}%`}
                 </text>
               )}>
            {dados.map((_, i) => <Cell key={i} fill={CORES_CATEGORIA[i % CORES_CATEGORIA.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number, nome: string) => [`${f.moeda(v, moeda)} (${total ? Math.round(v / total * 100) : 0}%)`, nome]}
                   contentStyle={ESTILO_TOOLTIP} />
          <Legend wrapperStyle={ESTILO_LEGENDA} formatter={(v: string) => <span style={{ color: TINTA }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
