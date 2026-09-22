"use client";
import { useState } from "react";
import { criarVenda } from "@/app/actions/vendas";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { detalharCustoVenda } from "@/lib/calculos";
import { CATEGORIAS_RECEITA, UNIDADES_VOLUME, type Moeda } from "@/lib/types";

interface Props { projetoId: string; moeda: Moeda }

export function FormVenda(props: Props) {
  const [estado, formAction] = useAcaoFormulario(criarVenda);
  // A key remonta os campos (e o estado local de volume/preço) após cada venda registrada.
  return <Campos key={estado.versao} {...props} estado={estado} formAction={formAction} />;
}

function Campos({ projetoId, moeda, estado, formAction }:
  Props & { estado: EstadoFormulario; formAction: (fd: FormData) => void }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const hoje = useHoje();
  const [vol, setVol] = useState(0);
  const [preco, setPreco] = useState(0);
  const [custo, setCusto] = useState(0);
  const [frete, setFrete] = useState(0);
  const [impostos, setImpostos] = useState(0);
  const [comissao, setComissao] = useState(0);
  const detalhe = detalharCustoVenda({
    volume: vol || 0, preco_unitario: preco || 0, custo_unitario: custo || 0,
    frete_unitario: frete || 0, impostos_pct: impostos || 0, comissao_pct: comissao || 0,
  });

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="projeto_id" value={projetoId} />
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="data">{d.vendas.dataVenda}</label>
        <input id="data" name="data" type="date" required className="campo" defaultValue={hoje} />
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
      <fieldset className="rounded-md border border-stone-light px-4 py-4 sm:col-span-6">
        <legend className="px-2 text-stone">{d.vendas.custos}</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="rotulo" htmlFor="custo_unitario">{fmtTexto(d.vendas.custoUnitario, { moeda })}</label>
            <input id="custo_unitario" name="custo_unitario" type="number" inputMode="decimal" min="0" step="0.01"
                   className="campo num" defaultValue={0} onChange={(e) => setCusto(Number(e.target.value))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="frete_unitario">{fmtTexto(d.vendas.freteUnitario, { moeda })}</label>
            <input id="frete_unitario" name="frete_unitario" type="number" inputMode="decimal" min="0" step="0.01"
                   className="campo num" defaultValue={0} onChange={(e) => setFrete(Number(e.target.value))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="impostos_pct">{d.vendas.impostosPct}</label>
            <input id="impostos_pct" name="impostos_pct" type="number" inputMode="decimal" min="0" max="100" step="0.01"
                   className="campo num" defaultValue={0} onChange={(e) => setImpostos(Number(e.target.value))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="comissao_pct">{d.vendas.comissaoPct}</label>
            <input id="comissao_pct" name="comissao_pct" type="number" inputMode="decimal" min="0" max="100" step="0.01"
                   className="campo num" defaultValue={0} onChange={(e) => setComissao(Number(e.target.value))} />
          </div>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-6">
        <SubmitButton>{d.vendas.registrar}</SubmitButton>
        <p className="text-stone">{d.vendas.receitaCalculada} <span className="num font-semibold text-navy">{f.moeda((vol || 0) * (preco || 0), moeda)}</span></p>
        <p className="text-stone">
          {d.vendas.margemCalculada}{" "}
          <span className={`num font-semibold ${detalhe.margem < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(detalhe.margem, moeda)}</span>
          {detalhe.total > 0 && <span className="text-stone"> ({f.moeda(detalhe.total, moeda)} {d.vendas.custoTotal.toLowerCase()})</span>}
        </p>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
