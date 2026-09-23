"use client";
import { criarEmpresa } from "@/app/actions/master";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { PLANOS_EMPRESA } from "@/lib/types";

export function FormEmpresa() {
  const [estado, formAction] = useAcaoFormulario(criarEmpresa);
  // A key limpa os campos depois de cada empresa liberada.
  return <Campos key={estado.versao} estado={estado} formAction={formAction} />;
}

function Campos({ estado, formAction }: { estado: EstadoFormulario; formAction: (fd: FormData) => void }) {
  const { d } = useI18n();
  const t = d.master;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="nome">{t.nomeEmpresa}</label>
        <input id="nome" name="nome" required maxLength={120} className="campo" />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="email_adm">{t.emailAdm}</label>
        <input id="email_adm" name="email_adm" type="email" required maxLength={320} className="campo" />
        <p className="mt-1 text-sm text-stone">{t.emailAdmAjuda}</p>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="plano">{t.plano}</label>
        <select id="plano" name="plano" className="campo" defaultValue="avaliacao">
          {PLANOS_EMPRESA.map((p) => <option key={p} value={p}>{d.enums.planoEmpresa[p]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="assentos">{t.assentos}</label>
        <input id="assentos" name="assentos" type="number" inputMode="numeric" min="1" max="10000" className="campo num" />
        <p className="mt-1 text-sm text-stone">{t.assentosAjuda}</p>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="vigencia_ate">{t.vigencia}</label>
        <input id="vigencia_ate" name="vigencia_ate" type="date" className="campo" />
        <p className="mt-1 text-sm text-stone">{t.vigenciaAjuda}</p>
      </div>
      <div className="sm:col-span-6"><SubmitButton>{t.liberar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
