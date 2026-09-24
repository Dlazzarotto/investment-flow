"use client";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import { LABEL_MOEDA } from "@/lib/labels";
import { MOEDAS, STATUS_PROJETO, type ActionState, type Projeto } from "@/lib/types";
import { useHoje } from "@/components/ui/useHoje";

/**
 * Cria (sem `projeto`) ou edita (com `projeto`) um projeto que a empresa ADMINISTRA
 * (0022). Tipo de parceria saiu: quem entra e como (sócio direto, JV, investidor)
 * mora em "Sócios e investidores". A participação da empresa nasce 0 %.
 */
export function FormProjeto({ action, projeto }:
  { action: (s: ActionState, fd: FormData) => Promise<ActionState>; projeto?: Projeto }) {
  const { d } = useI18n();
  const [estado, formAction] = useFormState(action, { ok: false } as ActionState);
  const hoje = useHoje();
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {projeto && <input type="hidden" name="id" value={projeto.id} />}
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="nome">{d.projetos.nome}</label>
        <input id="nome" name="nome" required maxLength={120} className="campo" defaultValue={projeto?.nome} placeholder={d.projetos.nomePlaceholder} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="descricao">{d.projetos.descricao}</label>
        <textarea id="descricao" name="descricao" rows={3} className="campo py-2" defaultValue={projeto?.descricao ?? ""} placeholder={d.projetos.descricaoPlaceholder} />
      </div>
      <div>
        <label className="rotulo" htmlFor="data_inicio">{d.projetos.dataInicio}</label>
        <input id="data_inicio" name="data_inicio" type="date" required className="campo" defaultValue={projeto?.data_inicio ?? hoje} />
      </div>
      <div>
        <label className="rotulo" htmlFor="moeda">{d.projetos.moeda}</label>
        <select id="moeda" name="moeda" className="campo" defaultValue={projeto?.moeda ?? "USD"}>
          {MOEDAS.map((m) => <option key={m} value={m}>{m} ({LABEL_MOEDA[m]})</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="status">{d.projetos.status}</label>
        <select id="status" name="status" className="campo" defaultValue={projeto?.status ?? "em_analise"}>
          {STATUS_PROJETO.map((x) => <option key={x} value={x}>{d.enums.statusProjeto[x]}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="participacao_pct">{d.projetos.participacaoEmpresa}</label>
        <input id="participacao_pct" name="participacao_pct" type="number" inputMode="decimal" min={0} max={100} step="0.01"
               className="campo num" defaultValue={projeto?.participacao_pct ?? 0} />
        <p className="mt-1 text-sm text-stone">{d.projetos.participacaoEmpresaAjuda}</p>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{projeto ? d.projetos.salvar : d.projetos.criar}</SubmitButton>
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}
