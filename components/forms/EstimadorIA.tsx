"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { EstimativaIA, Moeda } from "@/lib/types";

/** Consulta a IA para obter o valor médio de mercado do item e aplica no valor unitário. */
export function EstimadorIA({ projetoId, item, moeda, onAplicar }:
  { projetoId: string; item: string; moeda: Moeda; onAplicar: (valor: number) => void }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const [contexto, setContexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [estimativa, setEstimativa] = useState<EstimativaIA | null>(null);
  const [observacao, setObservacao] = useState<string | null>(null);

  async function estimar() {
    setErro(null); setEstimativa(null); setObservacao(null); setCarregando(true);
    try {
      const r = await fetch("/api/ia/estimar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ projeto_id: projetoId, item, contexto }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? d.ia.falha);
      setEstimativa(dados.estimativa); setObservacao(dados.observacao ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : d.ia.falha);
    } finally {
      setCarregando(false);
    }
  }
  const itemOk = item.trim().length >= 2;

  return (
    <div className="rounded-md border border-navy-soft bg-navy-soft/40 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="ia_contexto">{d.ia.titulo}</label>
          <input id="ia_contexto" className="campo" value={contexto} onChange={(e) => setContexto(e.target.value)} maxLength={500} placeholder={d.ia.placeholder} />
        </div>
        <button type="button" onClick={estimar} disabled={!itemOk || carregando} className="btn-navy" aria-busy={carregando}>
          {carregando ? d.ia.pesquisando : d.ia.estimar}
        </button>
      </div>
      {!itemOk && <p className="mt-2 text-sm text-stone">{d.ia.preenchaItem}</p>}
      {carregando && <p className="mt-2 text-sm text-stone">{d.ia.aguarde}</p>}
      {erro && <p role="alert" className="mt-3 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3 text-loss">{erro}</p>}
      {estimativa && (
        <div className="mt-4 rounded-md border border-stone-light bg-white px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-sm text-stone">{d.ia.minimo}</p><p className="num text-lg">{f.moeda(Number(estimativa.valor_min), moeda)}</p></div>
            <div><p className="text-sm text-stone">{d.ia.medio}</p><p className="num text-xl font-semibold text-navy">{f.moeda(Number(estimativa.valor_medio), moeda)}</p></div>
            <div><p className="text-sm text-stone">{d.ia.maximo}</p><p className="num text-lg">{f.moeda(Number(estimativa.valor_max), moeda)}</p></div>
          </div>
          <p className="mt-2 text-sm text-stone">
            {fmtTexto(d.ia.por, { unidade: estimativa.unidade_ref })} · {d.enums.confianca[estimativa.confianca]} · {f.data(estimativa.criado_em)} · {estimativa.modelo}
          </p>
          {observacao && <p className="mt-2 text-base">{observacao}</p>}
          {estimativa.premissas.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-navy">{d.ia.premissas}</p>
              <ul className="mt-1 list-disc pl-5 text-base">{estimativa.premissas.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {estimativa.fontes.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-navy">{d.ia.fontes}</p>
              <ul className="mt-1 list-disc pl-5 text-base">
                {estimativa.fontes.map((fo, i) => <li key={i}><a href={fo.url} target="_blank" rel="noopener noreferrer" className="break-all text-navy underline">{fo.titulo}</a></li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primario" onClick={() => onAplicar(Number(estimativa.valor_medio))}>{d.ia.usarMedio}</button>
            <button type="button" className="btn-quieto" onClick={() => onAplicar(Number(estimativa.valor_min))}>{d.ia.usarMin}</button>
            <button type="button" className="btn-quieto" onClick={() => onAplicar(Number(estimativa.valor_max))}>{d.ia.usarMax}</button>
          </div>
          <p className="mt-3 text-sm text-stone">{d.ia.aviso}</p>
        </div>
      )}
    </div>
  );
}
