"use client";
import { useState } from "react";
import { criarAporte } from "@/app/actions/aportes";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { TIPOS_APORTE, type Moeda, type Participante } from "@/lib/types";

export function FormAporte({ projetoId, moeda, participantes }:
  { projetoId: string; moeda: Moeda; participantes: Pick<Participante, "id" | "nome">[] }) {
  const { d } = useI18n();
  const hoje = useHoje();
  const [estado, formAction] = useAcaoFormulario(criarAporte);
  const [tipo, setTipo] = useState<(typeof TIPOS_APORTE)[number]>("dinheiro");
  const t = d.aportes;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.versao}>
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="a_participante">{t.participante}</label>
        <select id="a_participante" name="participante_id" className="campo" required>
          {participantes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="a_tipo">{t.tipo}</label>
        <select id="a_tipo" name="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          {TIPOS_APORTE.map((x) => <option key={x} value={x}>{d.enums.tipoAporte[x]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-6">
        <label className="rotulo" htmlFor="a_descricao">{t.descricao}</label>
        <input id="a_descricao" name="descricao" required maxLength={200} className="campo" placeholder={t.descricaoPlaceholder} />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="a_valor">{fmtTexto(t.valor, { moeda })}</label>
        <input id="a_valor" name="valor" type="number" inputMode="decimal" min="0.01" step="0.01" required className="campo num" />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="a_data">{t.dataAporte}</label>
        <input id="a_data" name="data" type="date" required className="campo" defaultValue={hoje} />
      </div>
      <div className="sm:col-span-6">
        <label className="rotulo" htmlFor="a_obs">{t.observacoes}</label>
        <textarea id="a_obs" name="observacoes" rows={2} maxLength={2000} className="campo py-2" />
      </div>
      <div className="sm:col-span-6"><SubmitButton>{t.salvar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
