"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { margemNoPreco, type ResultadoCusteio } from "@/lib/custeio";
import type { EstimativaCusto } from "@/lib/types";

/**
 * O resultado do cálculo reverso: custo montado, preço que entrega a margem alvo e
 * a comparação com o que o mercado paga hoje.
 */
export function PainelResultado({ resultado: r, estimativa }:
  { resultado: ResultadoCusteio; estimativa: EstimativaCusto }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.custeio;
  const m = estimativa.moeda;
  const u = rotuloUnidade(estimativa.unidade, d);
  const [precoMercado, setPrecoMercado] = useState("");

  const mercado = Number(precoMercado);
  const temMercado = precoMercado.trim() !== "" && Number.isFinite(mercado) && mercado > 0;
  const margemMercado = temMercado ? margemNoPreco(r, mercado) : null;

  return (
    <div className="grid gap-6">
      {r.impossivel ? (
        <p role="alert" className="rounded-md border-l-4 border-loss bg-red-50 px-4 py-4 text-loss">
          {fmtTexto(t.impossivel, { pct: f.numero((r.taxaSobreReceita + r.margem) * 100) })}
        </p>
      ) : (
        <div className="rounded-md bg-navy px-5 py-6 text-white">
          <p className="text-white/80">{t.precoSugerido}</p>
          <p className="num mt-1 text-3xl font-semibold">{f.moeda(r.preco ?? 0, m)}</p>
          <p className="text-white/80">{fmtTexto(t.porUnidade, { unidade: u })}</p>
          <p className="mt-3 text-white/80">
            {t.margemUnidade}: <span className="num font-semibold text-white">{f.moeda(r.margemPorUnidade, m)}</span>
            {" · "}
            {f.pct(r.preco ? r.margemPorUnidade / r.preco : null)}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo={t.custoDireto} valor={f.moeda(r.custoDireto, m)} />
        <Cartao rotulo={t.custoIndireto} valor={f.moeda(r.custoIndireto, m)} />
        <Cartao rotulo={fmtTexto(t.custoUnitario, { unidade: u })} valor={f.moeda(r.custoUnitario, m)} destaque />
        <Cartao rotulo={t.impostos} valor={f.moeda(r.impostosPorUnidade, m)} nota={f.pct(r.taxaSobreReceita)} />
        <Cartao rotulo={t.custoTotalLote} valor={f.moeda(r.custoTotal, m)} />
        <Cartao rotulo={t.receitaTotalLote} valor={f.moeda(r.receitaTotal, m)} />
        <Cartao rotulo={t.margemTotalLote} valor={f.moeda(r.margemPorUnidade * Number(estimativa.volume_total), m)} />
        <Cartao rotulo={t.margemAlvo} valor={f.pct(r.margem)} />
      </dl>

      {r.itensIgnorados.length > 0 && (
        <div className="rounded-md border-l-4 border-loss bg-red-50 px-4 py-3">
          <p className="font-semibold text-loss">{t.ignorados}</p>
          <p className="mt-1">{t.ignoradosTexto}</p>
          <ul className="mt-2 list-disc pl-5">
            {r.itensIgnorados.map((i) => (
              <li key={i.id}>
                {i.nome} — {i.impedimento === "sem_producao_diaria" ? t.semProducaoDiaria : t.semCapacidade}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-stone-light bg-white p-4">
        <label className="rotulo" htmlFor="preco-mercado">{fmtTexto(t.precoMercado, { moeda: m, unidade: u })}</label>
        <input id="preco-mercado" type="number" inputMode="decimal" min="0" step="any" className="campo num max-w-xs"
               value={precoMercado} onChange={(e) => setPrecoMercado(e.target.value)} />
        <p className="mt-1 text-sm text-stone">{t.precoMercadoAjuda}</p>
        {margemMercado !== null && (
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <p>
              {t.margemNesse}:{" "}
              <span className={`num text-lg font-semibold ${margemMercado >= r.margem ? "text-gain" : "text-loss"}`}>
                {f.pct(margemMercado)}
              </span>
            </p>
            {r.preco !== null && (
              <p>
                {t.diferenca}:{" "}
                <span className={`num font-semibold ${mercado >= r.preco ? "text-gain" : "text-loss"}`}>
                  {f.moeda(mercado - r.preco, m)}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {r.porGrupo.length > 0 && (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>{t.porGrupo}</th>
                <th className="num">{fmtTexto(t.porUnidade, { unidade: u })}</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {r.porGrupo.map((g) => (
                <tr key={g.grupo}>
                  <td className="font-medium">{d.enums.grupoCusto[g.grupo]}</td>
                  <td className="num">{f.moeda(g.valor, m)}</td>
                  <td className="num">{f.pct(r.custoUnitario > 0 ? g.valor / r.custoUnitario : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false }:
  { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? "border-navy bg-navy-soft" : "border-stone-light bg-white"}`}>
      <dt className="text-sm text-stone">{rotulo}</dt>
      <dd className="num mt-1 text-lg font-semibold text-navy">{valor}</dd>
      {nota && <dd className="num text-sm text-stone">{nota}</dd>}
    </div>
  );
}
