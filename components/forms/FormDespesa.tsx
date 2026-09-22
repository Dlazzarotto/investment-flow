"use client";
import { criarDespesa } from "@/app/actions/despesas";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { CATEGORIAS_DESPESA, type Moeda } from "@/lib/types";

interface Props { projetoId: string; moeda: Moeda }

export function FormDespesa(props: Props) {
  const [estado, formAction] = useAcaoFormulario(criarDespesa);
  // A key remonta os campos após cada despesa salva.
  return <Campos key={estado.versao} {...props} estado={estado} formAction={formAction} />;
}

function Campos({ projetoId, moeda, estado, formAction }:
  Props & { estado: EstadoFormulario; formAction: (fd: FormData) => void }) {
  const { d } = useI18n();
  const hoje = useHoje();
  const t = d.despesas;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="descricao">{t.descricao}</label>
        <input id="descricao" name="descricao" required maxLength={160} className="campo" placeholder={t.descricaoPlaceholder} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="categoria">{d.comum.categoria}</label>
        <select id="categoria" name="categoria" className="campo">
          {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{d.enums.categoriaDespesa[c]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="valor">{fmtTexto(t.valor, { moeda })}</label>
        <input id="valor" name="valor" type="number" inputMode="decimal" min="0.01" step="0.01" required className="campo num" />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="data">{t.dataDespesa}</label>
        <input id="data" name="data" type="date" required className="campo" defaultValue={hoje} />
      </div>
      <div className="sm:col-span-6"><SubmitButton>{t.salvar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
