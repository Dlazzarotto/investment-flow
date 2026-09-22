"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarInvestimento, excluirInvestimento } from "@/app/actions/investimentos";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Vazio } from "@/components/ui/Vazio";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { desvioVsMedia } from "@/lib/calculos";
import { CATEGORIAS_INVESTIMENTO, type ActionState, type Investimento, type Moeda } from "@/lib/types";

/** Resumo da última estimativa de IA do item (um Map não atravessa a fronteira servidor → cliente). */
export interface MediaMercado { valor_min: number; valor_medio: number; valor_max: number; unidade_ref: string }
export interface LinhaInvestimento { investimento: Investimento; media: MediaMercado | null }

const COLUNAS = 9;

/** Tabela de investimentos com edição na própria linha (uma por vez). */
export function TabelaInvestimentos({ linhas, projetoId, moeda }:
  { linhas: LinhaInvestimento[]; projetoId: string; moeda: Moeda }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.investimentos;
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<ActionState | null>(null);

  if (linhas.length === 0) return <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} />;

  return (
    <>
      {aviso && <Mensagem estado={aviso} />}
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>{d.comum.data}</th><th>{t.item}</th><th>{d.comum.categoria}</th>
              <th className="num">{t.qtd}</th><th className="num">{t.valorUnit}</th>
              <th className="num">{t.mediaIA}</th><th className="num">{t.desvio}</th>
              <th className="num">{t.valorTotal}</th><th>{d.comum.acoes}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ investimento: i, media }) => {
              if (editando === i.id) {
                return (
                  <tr key={i.id} className="bg-navy-soft/50">
                    <td colSpan={COLUNAS} className="py-4">
                      {/* A tabela pode ser mais larga que a tela; o wrapper prende o formulário
                          à esquerda da área rolável para não precisar rolar na horizontal. */}
                      <div className="sticky left-0 w-[calc(100vw-2rem)] max-w-full">
                        <FormEdicao
                          investimento={i} projetoId={projetoId} moeda={moeda}
                          aoCancelar={() => setEditando(null)}
                          aoSalvar={(msg) => { setEditando(null); setAviso({ ok: true, sucesso: msg }); }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              }
              const desvio = media ? desvioVsMedia(Number(i.valor_unitario), Number(media.valor_medio)) : null;
              const corDesvio = desvio === null ? "text-stone" : desvio > 0.15 ? "text-loss" : desvio < -0.15 ? "text-gain" : "";
              return (
                <tr key={i.id}>
                  <td className="whitespace-nowrap">{f.data(i.data)}</td>
                  <td className="font-medium">{i.item}</td>
                  <td>{d.enums.categoriaInvestimento[i.categoria]}</td>
                  <td className="num">{f.numero(Number(i.quantidade), 2)}</td>
                  <td className="num">{f.moeda(Number(i.valor_unitario), moeda)}</td>
                  <td className="num" title={media ? fmtTexto(t.faixa, { min: f.moeda(Number(media.valor_min), moeda), max: f.moeda(Number(media.valor_max), moeda), unidade: media.unidade_ref }) : undefined}>
                    {media ? f.moeda(Number(media.valor_medio), moeda) : "—"}
                  </td>
                  <td className={`num ${corDesvio}`}>{desvio === null ? "—" : `${desvio > 0 ? "+" : ""}${f.pct(desvio)}`}</td>
                  <td className="num font-semibold">{f.moeda(Number(i.valor_total), moeda)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn-quieto px-3"
                              aria-label={fmtTexto(t.editarItem, { item: i.item })}
                              onClick={() => { setAviso(null); setEditando(i.id); }}>
                        {d.comum.editar}
                      </button>
                      <BotaoExcluir action={excluirInvestimento} id={i.id} projetoId={projetoId}
                                    confirmacao={fmtTexto(t.excluirConfirma, { item: i.item })} rotulo={d.comum.excluir} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-stone">{t.legendaDesvio}</p>
    </>
  );
}

function FormEdicao({ investimento: i, projetoId, moeda, aoCancelar, aoSalvar }:
  { investimento: Investimento; projetoId: string; moeda: Moeda; aoCancelar: () => void; aoSalvar: (msg: string) => void }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const [estado, formAction] = useAcaoFormulario(atualizarInvestimento);
  const [qtd, setQtd] = useState(Number(i.quantidade));
  const [unit, setUnit] = useState(Number(i.valor_unitario));
  const ultimaSalva = useRef(0);

  // Fecha a linha assim que a action confirma; o ref evita repetir a cada render.
  useEffect(() => {
    if (estado.versao > ultimaSalva.current) {
      ultimaSalva.current = estado.versao;
      if (estado.sucesso) aoSalvar(estado.sucesso);
    }
  });

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="id" value={i.id} />
      <input type="hidden" name="projeto_id" value={projetoId} />
      <p className="text-stone sm:col-span-6">{fmtTexto(d.investimentos.editando, { item: i.item })}</p>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor={`item-${i.id}`}>{d.investimentos.item}</label>
        <input id={`item-${i.id}`} name="item" required maxLength={160} className="campo" defaultValue={i.item} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`categoria-${i.id}`}>{d.comum.categoria}</label>
        <select id={`categoria-${i.id}`} name="categoria" className="campo" defaultValue={i.categoria}>
          {CATEGORIAS_INVESTIMENTO.map((c) => <option key={c} value={c}>{d.enums.categoriaInvestimento[c]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`quantidade-${i.id}`}>{d.investimentos.quantidade}</label>
        <input id={`quantidade-${i.id}`} name="quantidade" type="number" inputMode="decimal" min="0.001" step="any" required
               className="campo num" defaultValue={Number(i.quantidade)} onChange={(e) => setQtd(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`valor-${i.id}`}>{fmtTexto(d.investimentos.valorUnitario, { moeda })}</label>
        <input id={`valor-${i.id}`} name="valor_unitario" type="number" inputMode="decimal" min="0.01" step="0.01" required
               className="campo num" defaultValue={Number(i.valor_unitario)} onChange={(e) => setUnit(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`data-${i.id}`}>{d.investimentos.dataAporte}</label>
        <input id={`data-${i.id}`} name="data" type="date" required className="campo" defaultValue={i.data.slice(0, 10)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.comum.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
        <p className="text-stone">{d.investimentos.totalCalculado} <span className="num font-semibold text-navy">{f.moeda((qtd || 0) * (unit || 0), moeda)}</span></p>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
