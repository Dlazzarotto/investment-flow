"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatadores } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { CategoriaInvestimento, Moeda } from "@/lib/types";

const CORES = ["#2D3278", "#F47B20", "#7A80C4", "#1B8A6B"];

/** Gráfico 3 — distribuição dos investimentos por categoria. */
export function GraficoAlocacao({ alocacao, moeda }:
  { alocacao: { categoria: string; valor: number }[]; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const dados = alocacao.map((a) => ({
    nome: d.enums.categoriaInvestimento[a.categoria as CategoriaInvestimento] ?? a.categoria,
    valor: a.valor,
  }));
  const total = dados.reduce((s, d) => s + d.valor, 0);
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="52%" outerRadius="80%" paddingAngle={2}
               label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
            {dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number, nome: string) => [`${f.moeda(v, moeda)} (${total ? Math.round(v / total * 100) : 0}%)`, nome]}
                   contentStyle={{ fontSize: 15 }} />
          <Legend wrapperStyle={{ fontSize: 15 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
