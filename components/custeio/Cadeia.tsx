"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarEtapa, criarEtapa, excluirEtapa } from "@/app/actions/custeio";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { CampoPin } from "@/components/ui/CampoPin";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Vazio } from "@/components/ui/Vazio";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { MODAIS_ETAPA, type ActionState, type ProjetoEtapa } from "@/lib/types";

interface Props { etapas: ProjetoEtapa[]; projetoId: string; editavel: boolean; pedirPin?: boolean }

/**
 * A cadeia é do projeto, não da estimativa: "minério da Bolívia embarcando no
 * Uruguai" tem um percurso, "soja da Argentina por Porto Alegre" tem outro. Toda
 * estimativa do projeto lança custos sobre estas mesmas etapas.
 */
export function Cadeia({ etapas, projetoId, editavel, pedirPin = false }: Props) {
  const { d } = useI18n();
  const t = d.custeio;
  const [editando, setEditando] = useState<string | null>(null);
  const [incluindo, setIncluindo] = useState(false);
  const [aviso, setAviso] = useState<ActionState | null>(null);
  const proximaOrdem = etapas.reduce((m, e) => Math.max(m, e.ordem), 0) + 1;

  return (
    <>
      <p className="mb-4 text-stone">{t.cadeiaAjuda}</p>
      {aviso && <Mensagem estado={aviso} />}

      {etapas.length === 0 && !incluindo ? (
        <Vazio titulo={t.semEtapas} texto={t.semEtapasTexto} />
      ) : (
        <ol className="grid gap-3">
          {etapas.map((e, i) => (
            <li key={e.id}>
              {editavel && editando === e.id ? (
                <div className="rounded-md border border-navy bg-navy-soft/40 p-4">
                  <FormEtapa etapa={e} projetoId={projetoId} ordemPadrao={e.ordem} pedirPin={pedirPin}
                             aoCancelar={() => setEditando(null)}
                             aoSalvar={(msg) => { setEditando(null); setAviso({ ok: true, sucesso: msg }); }} />
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-3 rounded-md border border-stone-light bg-white p-4">
                  <span aria-hidden className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-base font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold text-navy">{e.nome}</p>
                    <p className="text-stone">
                      {d.enums.modalEtapa[e.modal]}
                      {(e.origem || e.destino) && ` · ${[e.origem, e.destino].filter(Boolean).join(" → ")}`}
                      {e.pais && ` · ${e.pais}`}
                    </p>
                    {e.observacoes && <p className="mt-1 text-sm text-stone">{e.observacoes}</p>}
                  </div>
                  {editavel && (
                    <div className="flex gap-2">
                      <button type="button" className="btn-quieto px-3"
                              aria-label={fmtTexto(t.editarEtapa, { nome: e.nome })}
                              onClick={() => { setAviso(null); setIncluindo(false); setEditando(e.id); }}>
                        {d.comum.editar}
                      </button>
                      <BotaoExcluir action={excluirEtapa} id={e.id} projetoId={projetoId} pedirPin={pedirPin}
                                    confirmacao={fmtTexto(t.etapaExcluirConfirma, { nome: e.nome })} rotulo={d.comum.excluir} />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editavel && (incluindo ? (
        <div className="mt-4 rounded-md border border-navy bg-navy-soft/40 p-4">
          <FormEtapa projetoId={projetoId} ordemPadrao={proximaOrdem} pedirPin={false}
                     aoCancelar={() => setIncluindo(false)}
                     aoSalvar={(msg) => { setIncluindo(false); setAviso({ ok: true, sucesso: msg }); }} />
        </div>
      ) : (
        <button type="button" className="btn-quieto mt-4" onClick={() => { setAviso(null); setEditando(null); setIncluindo(true); }}>
          + {t.novaEtapa}
        </button>
      ))}
    </>
  );
}

function FormEtapa({ etapa, projetoId, ordemPadrao, pedirPin, aoCancelar, aoSalvar }:
  { etapa?: ProjetoEtapa; projetoId: string; ordemPadrao: number; pedirPin: boolean;
    aoCancelar: () => void; aoSalvar: (msg: string) => void }) {
  const { d } = useI18n();
  const t = d.custeio;
  const [estado, formAction] = useAcaoFormulario(etapa ? atualizarEtapa : criarEtapa);
  const ultimaSalva = useRef(0);
  const id = etapa?.id ?? "nova";

  useEffect(() => {
    if (estado.versao > ultimaSalva.current) {
      ultimaSalva.current = estado.versao;
      if (estado.sucesso) aoSalvar(estado.sucesso);
    }
  });

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      {etapa && <input type="hidden" name="id" value={etapa.id} />}
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor={`etapa-nome-${id}`}>{t.etapaNome}</label>
        <input id={`etapa-nome-${id}`} name="nome" required maxLength={160} className="campo"
               placeholder={t.etapaNomePlaceholder} defaultValue={etapa?.nome} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`etapa-modal-${id}`}>{t.modal}</label>
        <select id={`etapa-modal-${id}`} name="modal" className="campo" defaultValue={etapa?.modal ?? "rodoviario"}>
          {MODAIS_ETAPA.map((m) => <option key={m} value={m}>{d.enums.modalEtapa[m]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`etapa-origem-${id}`}>{t.origem}</label>
        <input id={`etapa-origem-${id}`} name="origem" maxLength={160} className="campo" defaultValue={etapa?.origem ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`etapa-destino-${id}`}>{t.destino}</label>
        <input id={`etapa-destino-${id}`} name="destino" maxLength={160} className="campo" defaultValue={etapa?.destino ?? ""} />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`etapa-pais-${id}`}>{t.pais}</label>
        <input id={`etapa-pais-${id}`} name="pais" maxLength={80} className="campo" defaultValue={etapa?.pais ?? ""} />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`etapa-ordem-${id}`}>{t.ordem}</label>
        <input id={`etapa-ordem-${id}`} name="ordem" type="number" min="0" max="999" step="1"
               className="campo num" defaultValue={etapa?.ordem ?? ordemPadrao} />
      </div>
      <p className="-mt-2 text-sm text-stone sm:col-span-6">{t.paisAjuda}</p>
      <div className="sm:col-span-6">
        <label className="rotulo" htmlFor={`etapa-obs-${id}`}>{t.observacoes}</label>
        <input id={`etapa-obs-${id}`} name="observacoes" maxLength={1000} className="campo" defaultValue={etapa?.observacoes ?? ""} />
      </div>
      {pedirPin && <div className="sm:col-span-3"><CampoPin id={`etapa-${id}`} /></div>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{t.salvarEtapa}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
