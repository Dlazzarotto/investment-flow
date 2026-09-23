"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { ResultadoEstimativa } from "@/lib/ia/estimativa";
import type { DriverCusto, Moeda } from "@/lib/types";

export type SugestaoIA = ResultadoEstimativa;

interface Props {
  estimativaId: string;
  etapaId: string | null;
  /** Cargo ou serviço a pesquisar — é o nome que a pessoa está digitando no item. */
  descricao: string;
  driver: DriverCusto;
  tipoPadrao: "cargo" | "servico";
  moeda: Moeda;
  aoUsar: (s: SugestaoIA, valor: number) => void;
}

/**
 * Pergunta à IA quanto custa um cargo (pela legislação do país da etapa) ou um
 * serviço. A resposta volta na base do driver escolhido, então o número entra
 * direto no campo — e sai de lá marcado como sugestão até alguém confirmar.
 */
export function PainelIA({ estimativaId, etapaId, descricao, driver, tipoPadrao, moeda, aoUsar }: Props) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.custeio;
  const [tipo, setTipo] = useState<"cargo" | "servico">(tipoPadrao);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<SugestaoIA | null>(null);
  const [pais, setPais] = useState<string | null>(null);

  async function pesquisar() {
    if (descricao.trim().length < 2) { setErro(t.informeDescricao); return; }
    setCarregando(true); setErro(null); setSugestao(null);
    try {
      const resp = await fetch("/api/ia/custo", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimativa_id: estimativaId, etapa_id: etapaId ?? "", tipo, descricao, driver }),
      });
      const corpo = await resp.json().catch(() => null);
      if (!resp.ok) { setErro(corpo?.erro ?? d.ia.falha); return; }
      setSugestao(corpo.resultado as SugestaoIA);
      setPais((corpo.pais as string | null) ?? null);
    } catch {
      setErro(d.ia.falha);
    } finally {
      setCarregando(false);
    }
  }

  // Percentual não é dinheiro: mostrar "US$ 10,00" onde se quer "10 %" confunde.
  const mostrar = (v: number) =>
    driver === "pct_custo" || driver === "pct_receita" ? `${f.numero(v)} %` : f.moeda(v, moeda);

  return (
    <div className="rounded-md border border-stone-light bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="rotulo" htmlFor={`ia-tipo-${estimativaId}-${etapaId ?? "sem"}`}>{t.tipoCusto}</label>
          <select id={`ia-tipo-${estimativaId}-${etapaId ?? "sem"}`} className="campo" value={tipo}
                  onChange={(e) => setTipo(e.target.value as "cargo" | "servico")}>
            <option value="cargo">{t.tipoCargo}</option>
            <option value="servico">{t.tipoServico}</option>
          </select>
        </div>
        <button type="button" className="btn-navy" onClick={pesquisar} disabled={carregando} aria-busy={carregando}>
          {carregando ? t.sugerindo : t.sugerirIA}
        </button>
      </div>
      <p className="mt-2 text-sm text-stone">{fmtTexto(t.iaBase, { base: d.enums.driverCusto[driver] })}</p>
      {tipo === "cargo" && !pais && <p className="mt-1 text-sm text-stone">{t.iaSemPais}</p>}
      {carregando && <p className="mt-3 text-stone">{d.ia.aguarde}</p>}
      {erro && <p role="alert" className="mt-3 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3 text-loss">{erro}</p>}

      {sugestao && (
        <div className="mt-4 border-t border-stone-light pt-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="font-semibold text-navy">{sugestao.unidade_ref}</p>
            <p className="text-sm text-stone">{d.enums.confianca[sugestao.confianca]}</p>
            {pais && <p className="text-sm text-stone">{fmtTexto(t.iaPais, { pais })}</p>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {([["min", d.ia.minimo, sugestao.valor_min, d.ia.usarMin],
               ["med", d.ia.medio, sugestao.valor_medio, d.ia.usarMedio],
               ["max", d.ia.maximo, sugestao.valor_max, d.ia.usarMax]] as const).map(([k, rotulo, v, acao]) => (
              <div key={k} className="rounded-md bg-navy-soft/50 p-3">
                <p className="text-sm text-stone">{rotulo}</p>
                <p className="num text-lg font-semibold text-navy">{mostrar(v)}</p>
                <button type="button" className="btn-quieto mt-2 w-full px-3" onClick={() => aoUsar(sugestao, v)}>
                  {acao}
                </button>
              </div>
            ))}
          </div>
          {sugestao.premissas.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-navy">{d.ia.premissas}</p>
              <ul className="mt-1 list-disc pl-5 text-stone">
                {sugestao.premissas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {sugestao.observacao && <p className="mt-3 text-stone">{sugestao.observacao}</p>}
          {sugestao.fontes.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-navy">{d.ia.fontes}</p>
              <ul className="mt-1 grid gap-1">
                {sugestao.fontes.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-navy underline">{s.titulo}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 rounded-md border-l-4 border-orange bg-orange/5 px-4 py-3 text-sm">{t.iaAviso}</p>
        </div>
      )}
    </div>
  );
}
