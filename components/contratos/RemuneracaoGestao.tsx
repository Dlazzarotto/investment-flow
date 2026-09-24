"use client";
import { useState } from "react";
import { criarRemuneracao, excluirRemuneracao } from "@/app/actions/contratos";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { formatadores } from "@/lib/format";
import { TIPOS_REMUNERACAO, type Moeda, type RemuneracaoGestao as Linha, type TipoRemuneracao } from "@/lib/types";

/** Linha já projetada no servidor (lib/contratos.ts: projetarRemuneracao). */
export interface LinhaProjetada extends Linha { porAno: number | null; sobContratos: number | null }

/**
 * O que a empresa gestora ganha por administrar este projeto. Mais de uma linha
 * ao mesmo tempo é normal (ex.: 2 % a.a. + US$ 1,50/t). Os investidores não veem
 * esta seção: a tabela é da administração da empresa (RLS).
 */
export function RemuneracaoGestao({ linhas, organizacaoId, projetoId, moeda }:
  { linhas: LinhaProjetada[]; organizacaoId: string; projetoId: string; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.gestao;
  const [tipo, setTipo] = useState<TipoRemuneracao>("taxa_adm_anual_pct");
  const [estado, formAction] = useAcaoFormulario(criarRemuneracao);
  const ehPct = tipo !== "fixo_mensal" && tipo !== "por_unidade";

  return (
    <>
      {linhas.length === 0 ? (
        <p className="text-stone">{t.vazio}</p>
      ) : (
        <ul className="grid gap-2">
          {linhas.map((l) => {
            const pct = l.tipo !== "fixo_mensal" && l.tipo !== "por_unidade";
            const projecao = l.porAno !== null ? `${f.moeda(l.porAno, moeda)} ${t.porAno}`
              : l.sobContratos !== null ? `${f.moeda(l.sobContratos, moeda)} ${t.sobContratos}` : t.aConfirmar;
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-light bg-white p-3">
                <div>
                  <p className="font-semibold text-navy">
                    {d.enums.tipoRemuneracao[l.tipo]} · <span className="num">{pct ? `${f.numero(Number(l.valor), 2)} %` : f.moeda(Number(l.valor), moeda)}</span>
                  </p>
                  <p className="num text-stone">{projecao}</p>
                </div>
                <form action={excluirRemuneracao}
                      onSubmit={(e) => { if (!window.confirm(t.excluirConfirma)) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <form key={estado.versao} action={formAction} className="mt-4 grid gap-4 sm:grid-cols-6">
        <input type="hidden" name="organizacao_id" value={organizacaoId} />
        <input type="hidden" name="projeto_id" value={projetoId} />
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="g-tipo">{t.tipo}</label>
          <select id="g-tipo" name="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoRemuneracao)}>
            {TIPOS_REMUNERACAO.map((x) => <option key={x} value={x}>{d.enums.tipoRemuneracao[x]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="g-valor">{ehPct ? t.valorPct : `${t.valorMoeda} (${moeda})`}</label>
          <input id="g-valor" name="valor" type="number" inputMode="decimal" step="any" min="0" max={ehPct ? 100 : undefined}
                 required className="campo num" />
        </div>
        <p className="text-sm text-stone sm:col-span-6">{d.enums.descricaoRemuneracao[tipo]}</p>
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="g-ini">{t.inicio}</label>
          <input id="g-ini" name="inicio" type="date" className="campo" />
        </div>
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="g-fim">{t.fim}</label>
          <input id="g-fim" name="fim" type="date" className="campo" />
        </div>
        <div className="sm:col-span-6"><SubmitButton className="btn-quieto">{t.salvar}</SubmitButton></div>
        <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
      </form>
    </>
  );
}
