"use client";
import { definirPin, removerPin } from "@/app/actions/acesso";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { FormAcao } from "@/components/ui/FormAcao";

const PIN_MIN = 6;

/** Cadastra o PIN que libera alteração e exclusão para o papel Escritório. */
export function FormPin({ projetoId, temPin }: { projetoId: string; temPin: boolean }) {
  const { d } = useI18n();
  const t = d.acesso;
  const [estado, formAction] = useAcaoFormulario(definirPin);

  return (
    <>
      <p className="mb-4 text-stone">{t.pinTexto}</p>
      <p className="mb-4">
        <span className={`inline-block rounded-md px-3 py-1 ${temPin ? "bg-navy-soft text-navy" : "bg-orange-soft text-orange-deep"}`}>
          {temPin ? t.pinAtual : t.pinSemCadastro}
        </span>
        {!temPin && <span className="ml-2 text-stone">{t.pinSemPin}</span>}
      </p>
      <form action={formAction} className="grid gap-4 sm:max-w-lg sm:grid-cols-3" key={estado.versao}>
        <input type="hidden" name="projeto_id" value={projetoId} />
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="pin">{fmtTexto(t.pinNovo, { min: PIN_MIN })}</label>
          <input id="pin" name="pin" type="password" required minLength={PIN_MIN} maxLength={64}
                 autoComplete="off" className="campo" />
        </div>
        <div className="flex items-end"><SubmitButton>{t.pinSalvar}</SubmitButton></div>
        <div className="sm:col-span-3"><Mensagem estado={estado} /></div>
      </form>
      {temPin && (
        <FormAcao action={removerPin} className="mt-4"
              onSubmit={(e) => { if (!window.confirm(t.pinRemoverConfirma)) e.preventDefault(); }}>
          <input type="hidden" name="projeto_id" value={projetoId} />
          <button type="submit" className="btn-perigo px-3">{t.pinRemover}</button>
        </FormAcao>
      )}
    </>
  );
}
