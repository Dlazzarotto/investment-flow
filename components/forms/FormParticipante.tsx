"use client";
import { useFormState } from "react-dom";
import { criarParticipante } from "@/app/actions/participantes";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import { TIPOS_PARTICIPANTE, type ActionState } from "@/lib/types";

export function FormParticipante({ projetoId, disponivel }: { projetoId: string; disponivel: number }) {
  const { d } = useI18n();
  const [estado, formAction] = useFormState(criarParticipante, { ok: false } as ActionState);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.sucesso ?? "form"}>
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="p_nome">{d.parceria.nomeParticipante}</label>
        <input id="p_nome" name="nome" required maxLength={120} className="campo" placeholder={d.parceria.nomePlaceholder} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="p_tipo">{d.parceria.papel}</label>
        <select id="p_tipo" name="tipo" className="campo">
          {TIPOS_PARTICIPANTE.map((t) => <option key={t} value={t}>{d.enums.tipoParticipante[t]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor="p_pct">{d.parceria.participacaoPct}</label>
        <input id="p_pct" name="percentual" type="number" inputMode="decimal" min="0.01" max={100} step="0.01" required className="campo num" placeholder={disponivel > 0 ? String(disponivel) : "0"} />
      </div>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="p_contato">{d.parceria.contatoOpcional}</label>
        <input id="p_contato" name="contato" maxLength={200} className="campo" placeholder={d.parceria.contatoPlaceholder} />
      </div>
      <div className="flex items-end sm:col-span-2"><SubmitButton>{d.parceria.adicionar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
