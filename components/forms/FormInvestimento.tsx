"use client";
import { useState } from "react";
import { criarInvestimento } from "@/app/actions/investimentos";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { EstimadorIA } from "@/components/forms/EstimadorIA";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { CATEGORIAS_INVESTIMENTO, type Moeda } from "@/lib/types";

interface Props { projetoId: string; moeda: Moeda; iaDisponivel: boolean }

export function FormInvestimento(props: Props) {
  const [estado, formAction] = useAcaoFormulario(criarInvestimento);
  // A key remonta os campos (e o estado local: item, valor unitário, quantidade) após cada salvamento.
  return <Campos key={estado.versao} {...props} estado={estado} formAction={formAction} />;
}

function Campos({ projetoId, moeda, iaDisponivel, estado, formAction }:
  Props & { estado: EstadoFormulario; formAction: (fd: FormData) => void }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const hoje = useHoje();
  const [item, setItem] = useState("");
  const [qtd, setQtd] = useState(1);
  const [unit, setUnit] = useState<string>("");
  const unitNum = Number(unit) || 0;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="item">{d.investimentos.item}</label>
        <input id="item" name="item" required maxLength={160} className="campo" value={item} onChange={(e) => setItem(e.target.value)} placeholder={d.investimentos.itemPlaceholder} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="categoria">{d.comum.categoria}</label>
        <select id="categoria" name="categoria" className="campo">
          {CATEGORIAS_INVESTIMENTO.map((c) => <option key={c} value={c}>{d.enums.categoriaInvestimento[c]}</option>)}
        </select>
      </div>
      {iaDisponivel && (
        <div className="sm:col-span-6">
          <EstimadorIA projetoId={projetoId} item={item} moeda={moeda} onAplicar={(v) => setUnit(String(v))} />
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="quantidade">{d.investimentos.quantidade}</label>
        <input id="quantidade" name="quantidade" type="number" inputMode="decimal" min="0.001" step="any" required className="campo num" defaultValue={1} onChange={(e) => setQtd(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="valor_unitario">{fmtTexto(d.investimentos.valorUnitario, { moeda })}</label>
        <input id="valor_unitario" name="valor_unitario" type="number" inputMode="decimal" min="0.01" step="0.01" required className="campo num" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="data">{d.investimentos.dataAporte}</label>
        <input id="data" name="data" type="date" required className="campo" defaultValue={hoje} />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
        <SubmitButton>{d.investimentos.salvar}</SubmitButton>
        <p className="text-stone">{d.investimentos.totalCalculado} <span className="num font-semibold text-navy">{f.moeda((qtd || 0) * unitNum, moeda)}</span></p>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
