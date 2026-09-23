"use client";
import { criarFatura, gerarMensalidades } from "@/app/actions/master";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { MOEDAS, TIPOS_FATURA, type Moeda } from "@/lib/types";

/** Emite a mensalidade do mês de quem está ativo. Rodar de novo não duplica. */
export function FormGerarMensalidades() {
  const { d } = useI18n();
  const hoje = useHoje();
  const [estado, formAction] = useAcaoFormulario(gerarMensalidades);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="competencia" value={hoje} />
      <SubmitButton className="btn-quieto">{d.master.gerar}</SubmitButton>
      <div className="w-full"><Mensagem estado={estado} /></div>
    </form>
  );
}

export function FormFatura({ organizacaoId, moedaPadrao, diaVencimento }:
  { organizacaoId: string; moedaPadrao: Moeda; diaVencimento: number }) {
  const [estado, formAction] = useAcaoFormulario(criarFatura);
  return <Campos key={estado.versao} organizacaoId={organizacaoId} moedaPadrao={moedaPadrao}
                 diaVencimento={diaVencimento} estado={estado} formAction={formAction} />;
}

function Campos({ organizacaoId, moedaPadrao, diaVencimento, estado, formAction }:
  { organizacaoId: string; moedaPadrao: Moeda; diaVencimento: number;
    estado: ReturnType<typeof useAcaoFormulario>[0]; formAction: (fd: FormData) => void }) {
  const { d } = useI18n();
  const t = d.master;
  const hoje = useHoje();
  const mes = `${hoje.slice(0, 8)}01`;
  // Vencimento sugerido: o dia do contrato, no mês corrente.
  const venc = `${hoje.slice(0, 8)}${String(diaVencimento).padStart(2, "0")}`;

  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`tipo-${organizacaoId}`}>{t.tipoFatura}</label>
        <select id={`tipo-${organizacaoId}`} name="tipo" className="campo" defaultValue="mensalidade">
          {TIPOS_FATURA.map((x) => <option key={x} value={x}>{d.enums.tipoFatura[x]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`comp-${organizacaoId}`}>{t.competencia}</label>
        <input id={`comp-${organizacaoId}`} name="competencia" type="date" required className="campo" defaultValue={mes} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`venc-${organizacaoId}`}>{t.vencimento}</label>
        <input id={`venc-${organizacaoId}`} name="vencimento" type="date" required className="campo" defaultValue={venc} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`valor-${organizacaoId}`}>{t.valorFatura}</label>
        <input id={`valor-${organizacaoId}`} name="valor" type="number" inputMode="decimal" min="0.01" step="0.01"
               required className="campo num" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`moeda-${organizacaoId}`}>{d.projetos.moeda}</label>
        <select id={`moeda-${organizacaoId}`} name="moeda" className="campo" defaultValue={moedaPadrao}>
          {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`desc-${organizacaoId}`}>{t.descricaoFatura}</label>
        <input id={`desc-${organizacaoId}`} name="descricao" maxLength={200} className="campo" />
      </div>
      <div className="sm:col-span-6"><SubmitButton className="btn-quieto">{t.novaFatura}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
