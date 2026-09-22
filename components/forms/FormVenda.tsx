"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { criarVenda } from "@/app/actions/vendas";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores, hojeISO } from "@/lib/format";
import { CATEGORIAS_RECEITA, UNIDADES_VOLUME, type ActionState, type Moeda } from "@/lib/types";

export function FormVenda({ projetoId, moeda }: { projetoId: string; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const [estado, formAction] = useFormState(criarVenda, { ok: false } as ActionState);
  const [vol, setVol] = useState(0);
  const [preco, setPreco] = useState(0);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.sucesso ?? "form"}>
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="data">{d.vendas.dataVenda}</label>
        <input id="data" name="data" type="date" required className="campo" defaultValue={hojeISO()} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="categoria">{d.vendas.categoriaReceita}</label>
        <select id="categoria" name="categoria" className="campo">
          {CATEGORIAS_RECEITA.map((c) => <option key={c} value={c}>{d.enums.categoriaReceita[c]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="unidade">{d.vendas.unidadeVolume}</label>
        <select id="unidade" name="unidade" className="campo">
          {UNIDADES_VOLUME.map((u) => <option key={u} value={u}>{d.enums.unidades[u]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="volume">{d.vendas.volume}</label>
        <input id="volume" name="volume" type="number" inputMode="decimal" min="0.001" step="any" required className="campo num" onChange={(e) => setVol(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor="preco_unitario">{fmtTexto(d.vendas.preco, { moeda })}</label>
        <input id="preco_unitario" name="preco_unitario" type="number" inputMode="decimal" min="0.01" step="0.01" required className="campo num" onChange={(e) => setPreco(Number(e.target.value))} />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
        <SubmitButton>{d.vendas.registrar}</SubmitButton>
        <p className="text-stone">{d.vendas.receitaCalculada} <span className="num font-semibold text-navy">{f.moeda((vol || 0) * (preco || 0), moeda)}</span></p>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
