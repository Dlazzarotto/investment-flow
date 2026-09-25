"use client";
import { convidarMembro } from "@/app/actions/membros";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { PAPEIS_CONVIDAVEIS } from "@/lib/types";

export function FormMembro({ projetoId }: { projetoId: string }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(convidarMembro);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.versao}>
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="m_email">{d.membros.email}</label>
        <input id="m_email" name="email" type="email" required maxLength={320} autoComplete="off"
               className="campo" placeholder={d.membros.emailPlaceholder} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="m_papel">{d.membros.papel}</label>
        <select id="m_papel" name="papel" className="campo" defaultValue="leitor">
          {PAPEIS_CONVIDAVEIS.map((p) => <option key={p} value={p}>{d.enums.papelMembro[p]}</option>)}
        </select>
      </div>
      <div className="flex items-end sm:col-span-1"><SubmitButton>{d.membros.convidar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
