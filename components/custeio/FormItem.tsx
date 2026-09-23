"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarItem, criarItem } from "@/app/actions/custeio";
import { CampoPin } from "@/components/ui/CampoPin";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { ehPercentual } from "@/lib/custeio";
import {
  DRIVERS_CUSTO, GRUPOS_CUSTO, type DriverCusto, type EstimativaItem, type GrupoCusto, type Moeda,
} from "@/lib/types";
import { PainelIA, type SugestaoIA } from "./PainelIA";

interface Props {
  estimativaId: string;
  projetoId: string;
  /** Etapa em que o custo entra; null é o balde "fora de etapa". */
  etapaId: string | null;
  moeda: Moeda;
  unidade: string;
  item?: EstimativaItem;
  pedirPin: boolean;
  aoCancelar: () => void;
  aoSalvar: (msg: string) => void;
}

/** Grupos em que a pergunta natural à IA é de salário, e não de preço de serviço. */
const GRUPOS_DE_CARGO: readonly GrupoCusto[] = ["pessoal"];

export function FormItem(props: Props) {
  const { estimativaId, projetoId, etapaId, moeda, unidade, item, pedirPin, aoCancelar, aoSalvar } = props;
  const { d } = useI18n();
  const t = d.custeio;
  const [estado, formAction] = useAcaoFormulario(item ? atualizarItem : criarItem);
  const ultimaSalva = useRef(0);
  const id = item?.id ?? `novo-${etapaId ?? "sem"}`;

  const [nome, setNome] = useState(item?.nome ?? "");
  const [grupo, setGrupo] = useState<GrupoCusto>(item?.grupo ?? (etapaId ? "producao" : "administrativo"));
  const [driver, setDriver] = useState<DriverCusto>(item?.driver ?? "por_unidade");
  const [valor, setValor] = useState<string>(item ? String(Number(item.valor)) : "");
  // 'ia' marca o que o modelo sugeriu; só sai quando alguém confirma.
  const [origem, setOrigem] = useState<"manual" | "ia">(item?.origem ?? "manual");
  const [fonte, setFonte] = useState<string>(item?.fonte ?? "");

  const pct = ehPercentual(driver);
  const u = rotuloUnidade(unidade, d);

  useEffect(() => {
    if (estado.versao > ultimaSalva.current) {
      ultimaSalva.current = estado.versao;
      if (estado.sucesso) aoSalvar(estado.sucesso);
    }
  });

  function usarSugestao(s: SugestaoIA, v: number) {
    setValor(String(v));
    setOrigem("ia");
    setFonte([s.unidade_ref, s.fontes[0]?.url].filter(Boolean).join(" · ").slice(0, 500));
  }

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="projeto_id" value={projetoId} />
      <input type="hidden" name="estimativa_id" value={estimativaId} />
      <input type="hidden" name="etapa_id" value={etapaId ?? ""} />
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="fonte" value={fonte} />

      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor={`item-nome-${id}`}>{t.itemNome}</label>
        <input id={`item-nome-${id}`} name="nome" required maxLength={160} className="campo"
               placeholder={t.itemNomePlaceholder} value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`item-grupo-${id}`}>{t.grupo}</label>
        <select id={`item-grupo-${id}`} name="grupo" className="campo" value={grupo}
                onChange={(e) => setGrupo(e.target.value as GrupoCusto)}>
          {GRUPOS_CUSTO.map((g) => <option key={g} value={g}>{d.enums.grupoCusto[g]}</option>)}
        </select>
      </div>

      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`item-driver-${id}`}>{t.driver}</label>
        <select id={`item-driver-${id}`} name="driver" className="campo" value={driver}
                onChange={(e) => setDriver(e.target.value as DriverCusto)}>
          {DRIVERS_CUSTO.map((x) => <option key={x} value={x}>{d.enums.driverCusto[x]}</option>)}
        </select>
        <p className="mt-1 text-sm text-stone">{fmtTexto(t.driverAjuda, { unidade: u })}</p>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`item-valor-${id}`}>
          {pct ? t.valorPct : fmtTexto(t.valor, { moeda })}
        </label>
        <input id={`item-valor-${id}`} name="valor" type="number" inputMode="decimal" min="0"
               max={pct ? 100 : undefined} step="any" required className="campo num"
               value={valor} onChange={(e) => { setValor(e.target.value); setOrigem("manual"); }} />
      </div>

      {/* Percentual não se multiplica por quantidade nem cabe numa viagem. */}
      {!pct && (
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor={`item-qtd-${id}`}>{t.quantidade}</label>
          <input id={`item-qtd-${id}`} name="quantidade" type="number" inputMode="decimal" min="0.001" step="any"
                 required className="campo num" defaultValue={item ? Number(item.quantidade) : 1} />
          <p className="mt-1 text-sm text-stone">{t.quantidadeAjuda}</p>
        </div>
      )}
      {pct && <input type="hidden" name="quantidade" value={1} />}
      {driver === "por_viagem" ? (
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor={`item-cap-${id}`}>{fmtTexto(t.capacidade, { unidade: u })}</label>
          <input id={`item-cap-${id}`} name="capacidade" type="number" inputMode="decimal" min="0.001" step="any"
                 required className="campo num" defaultValue={item?.capacidade ? Number(item.capacidade) : ""} />
        </div>
      ) : (
        <input type="hidden" name="capacidade" value="" />
      )}

      {origem === "ia" && (
        <div className="sm:col-span-6 rounded-md border-l-4 border-orange bg-orange/5 px-4 py-3">
          <p className="font-medium text-navy">{t.marcadoIA}</p>
          {fonte && <p className="mt-1 text-sm text-stone">{t.fonte}: {fonte}</p>}
          <label className="mt-2 flex min-h-touch items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-navy"
                   onChange={(e) => { if (e.target.checked) { setOrigem("manual"); setFonte(""); } }} />
            <span>{t.confirmarIA}</span>
          </label>
        </div>
      )}

      <div className="sm:col-span-6">
        <PainelIA estimativaId={estimativaId} etapaId={etapaId} descricao={nome} driver={driver}
                  tipoPadrao={GRUPOS_DE_CARGO.includes(grupo) ? "cargo" : "servico"}
                  moeda={moeda} aoUsar={usarSugestao} />
      </div>

      {pedirPin && item && <div className="sm:col-span-3"><CampoPin id={`item-${id}`} /></div>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{t.salvarItem}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
