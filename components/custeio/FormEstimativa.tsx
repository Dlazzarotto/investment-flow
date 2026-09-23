"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarEstimativa, criarEstimativa, excluirEstimativa } from "@/app/actions/custeio";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { CampoPin } from "@/components/ui/CampoPin";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import {
  MODOS_ESTIMATIVA, MOEDAS, UNIDADES_VOLUME, type EstimativaCusto, type Moeda,
} from "@/lib/types";

/** Nova estimativa: a action redireciona para a tela dela assim que grava. */
export function FormEstimativa({ projetoId, moedaPadrao }: { projetoId: string; moedaPadrao: Moeda }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(criarEstimativa);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="projeto_id" value={projetoId} />
      <Campos moedaPadrao={moedaPadrao} />
      <div className="sm:col-span-6"><SubmitButton>{d.custeio.salvarEstimativa}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

/** Cabeçalho da estimativa aberta: os mesmos campos, já preenchidos, mais a exclusão. */
export function ParametrosEstimativa({ estimativa, projetoId, editavel, pedirPin = false }:
  { estimativa: EstimativaCusto; projetoId: string; editavel: boolean; pedirPin?: boolean }) {
  const { d } = useI18n();
  const [aberto, setAberto] = useState(false);
  const [estado, formAction] = useAcaoFormulario(atualizarEstimativa);
  const t = d.custeio;

  if (!editavel) return null;
  if (!aberto) {
    return <button type="button" className="btn-quieto" onClick={() => setAberto(true)}>{d.comum.editar} · {t.parametros}</button>;
  }
  // A exclusão fica FORA do <form> de edição: BotaoExcluir é um formulário próprio,
  // e formulário dentro de formulário é HTML inválido — o navegador desmonta um dos dois.
  return (
    <div className="rounded-md border border-navy bg-navy-soft/40 p-4">
      <form action={formAction} className="grid gap-4 sm:grid-cols-6">
        <input type="hidden" name="id" value={estimativa.id} />
        <input type="hidden" name="projeto_id" value={projetoId} />
        <Campos moedaPadrao={estimativa.moeda} estimativa={estimativa} />
        {pedirPin && <div className="sm:col-span-3"><CampoPin id={`est-${estimativa.id}`} /></div>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
          <SubmitButton>{d.comum.salvar}</SubmitButton>
          <button type="button" className="btn-quieto" onClick={() => setAberto(false)}>{d.comum.cancelar}</button>
        </div>
        <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
      </form>
      <div className="mt-4 flex justify-end border-t border-stone-light pt-4">
        <BotaoExcluir action={excluirEstimativa} id={estimativa.id} projetoId={projetoId} pedirPin={pedirPin}
                      confirmacao={fmtTexto(t.estimativaExcluirConfirma, { nome: estimativa.nome })} rotulo={d.comum.excluir} />
      </div>
    </div>
  );
}

function Campos({ estimativa, moedaPadrao }: { estimativa?: EstimativaCusto; moedaPadrao: Moeda }) {
  const { d } = useI18n();
  const t = d.custeio;
  const id = estimativa?.id ?? "nova";
  // A unidade rotula os campos de volume e produção; acompanhar o campo evita
  // "Volume do lote (Toneladas)" enquanto o usuário já mudou para m³.
  const [unidade, setUnidade] = useState(estimativa?.unidade ?? "Toneladas");
  const [modo, setModo] = useState(estimativa?.modo ?? "producao_propria");
  const u = rotuloUnidade(unidade, d);
  const primeiro = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!estimativa) primeiro.current?.focus(); }, [estimativa]);

  return (
    <>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor={`est-nome-${id}`}>{t.nome}</label>
        <input ref={primeiro} id={`est-nome-${id}`} name="nome" required maxLength={160} className="campo"
               placeholder={t.nomePlaceholder} defaultValue={estimativa?.nome} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`est-cliente-${id}`}>{t.cliente}</label>
        <input id={`est-cliente-${id}`} name="cliente" maxLength={160} className="campo" defaultValue={estimativa?.cliente ?? ""} />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`est-commodity-${id}`}>{t.commodity}</label>
        <input id={`est-commodity-${id}`} name="commodity" required maxLength={120} className="campo"
               placeholder={t.commodityPlaceholder} defaultValue={estimativa?.commodity} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`est-modo-${id}`}>{t.modo}</label>
        <select id={`est-modo-${id}`} name="modo" className="campo" value={modo}
                onChange={(e) => setModo(e.target.value as typeof modo)}>
          {MODOS_ESTIMATIVA.map((m) => <option key={m} value={m}>{d.enums.modoEstimativa[m]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`est-moeda-${id}`}>{d.projetos.moeda}</label>
        <select id={`est-moeda-${id}`} name="moeda" className="campo" defaultValue={estimativa?.moeda ?? moedaPadrao}>
          {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`est-unidade-${id}`}>{t.unidadeProduto}</label>
        <input id={`est-unidade-${id}`} name="unidade" required maxLength={40} className="campo" list={`unidades-${id}`}
               value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        <datalist id={`unidades-${id}`}>
          {UNIDADES_VOLUME.map((x) => <option key={x} value={x}>{rotuloUnidade(x, d)}</option>)}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`est-volume-${id}`}>{fmtTexto(t.volumeTotal, { unidade: u })}</label>
        <input id={`est-volume-${id}`} name="volume_total" type="number" inputMode="decimal" min="0.001" step="any"
               required className="campo num" defaultValue={estimativa ? Number(estimativa.volume_total) : ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`est-margem-${id}`}>{t.margemAlvo}</label>
        <input id={`est-margem-${id}`} name="margem_alvo_pct" type="number" inputMode="decimal" min="0" max="99.99" step="0.01"
               className="campo num" defaultValue={estimativa ? Number(estimativa.margem_alvo_pct) : 20} />
      </div>
      {/* Na revenda não há produção diária a ratear: os campos só atrapalhariam. */}
      {modo === "producao_propria" && (
        <>
          <div className="sm:col-span-3">
            <label className="rotulo" htmlFor={`est-producao-${id}`}>{fmtTexto(t.producaoDiaria, { unidade: u })}</label>
            <input id={`est-producao-${id}`} name="producao_diaria" type="number" inputMode="decimal" min="0" step="any"
                   className="campo num" defaultValue={estimativa ? Number(estimativa.producao_diaria) : 0} />
            <p className="mt-1 text-sm text-stone">{t.producaoDiariaAjuda}</p>
          </div>
          <div className="sm:col-span-3">
            <label className="rotulo" htmlFor={`est-dias-${id}`}>{t.diasMes}</label>
            <input id={`est-dias-${id}`} name="dias_mes" type="number" inputMode="numeric" min="1" max="31" step="1"
                   className="campo num" defaultValue={estimativa?.dias_mes ?? 26} />
          </div>
        </>
      )}
      {modo === "revenda" && (
        <>
          <input type="hidden" name="producao_diaria" value={estimativa ? Number(estimativa.producao_diaria) : 0} />
          <input type="hidden" name="dias_mes" value={estimativa?.dias_mes ?? 30} />
        </>
      )}
      <div className="sm:col-span-6">
        <label className="rotulo" htmlFor={`est-obs-${id}`}>{t.observacoes}</label>
        <input id={`est-obs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={estimativa?.observacoes ?? ""} />
      </div>
    </>
  );
}
