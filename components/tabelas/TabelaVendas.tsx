"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarVenda, excluirVenda } from "@/app/actions/vendas";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Vazio } from "@/components/ui/Vazio";
import { CampoPin } from "@/components/ui/CampoPin";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { detalharCustoVenda } from "@/lib/calculos";
import { CATEGORIAS_RECEITA, UNIDADES_VOLUME, type ActionState, type Moeda, type Venda } from "@/lib/types";

/** Colunas da tabela; a de ações só existe para quem pode editar. */
const COLUNAS_BASE = 8;

/** Tabela de vendas com edição na própria linha (uma por vez). */
export function TabelaVendas({ vendas, projetoId, moeda, editavel, pedirPin = false }:
  { vendas: Venda[]; projetoId: string; moeda: Moeda; editavel: boolean; pedirPin?: boolean }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.vendas;
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<ActionState | null>(null);

  if (vendas.length === 0) return <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} />;

  return (
    <>
      {aviso && <Mensagem estado={aviso} />}
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>{d.comum.data}</th><th>{d.comum.categoria}</th><th className="num">{t.volume}</th><th>{d.comum.unidade}</th>
              <th className="num">{t.precoUnit}</th><th className="num">{t.receita}</th>
              <th className="num">{t.custoTotal}</th><th className="num">{t.margem}</th>{editavel && <th>{d.comum.acoes}</th>}
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => {
              const custo = detalharCustoVenda(v);
              return editavel && editando === v.id ? (
              <tr key={v.id} className="bg-navy-soft/50">
                <td colSpan={COLUNAS_BASE + 1} className="py-4">
                  {/* A tabela pode ser mais larga que a tela; o wrapper prende o formulário
                      à esquerda da área rolável para não precisar rolar na horizontal. */}
                  <div className="sticky left-0 w-[calc(100vw-2rem)] max-w-full">
                    <FormEdicao
                      venda={v} projetoId={projetoId} moeda={moeda}
                      aoCancelar={() => setEditando(null)}
                      aoSalvar={(msg) => { setEditando(null); setAviso({ ok: true, sucesso: msg }); }}
                      pedirPin={pedirPin}
                    />
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={v.id}>
                <td className="whitespace-nowrap">{f.data(v.data)}</td>
                <td>{d.enums.categoriaReceita[v.categoria]}</td>
                <td className="num">{f.numero(Number(v.volume), 2)}</td>
                <td>{rotuloUnidade(v.unidade, d)}</td>
                <td className="num">{f.moeda(Number(v.preco_unitario), moeda)}</td>
                <td className="num font-semibold">{f.moeda(Number(v.receita_total), moeda)}</td>
                <td className="num" title={custo.total > 0 ? fmtTexto(t.detalheCusto, {
                  mercadoria: f.moeda(custo.mercadoria, moeda), frete: f.moeda(custo.frete, moeda),
                  impostos: f.moeda(custo.impostos, moeda), comissao: f.moeda(custo.comissao, moeda),
                }) : t.semCusto}>
                  {custo.total > 0 ? f.moeda(custo.total, moeda) : "—"}
                </td>
                <td className={`num font-semibold ${custo.margem < 0 ? "text-loss" : "text-gain"}`}>
                  {f.moeda(custo.margem, moeda)}
                  {custo.margemPct !== null && <span className="block text-stone">{f.pct(custo.margemPct)}</span>}
                </td>
                {editavel && (
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn-quieto px-3"
                              aria-label={fmtTexto(t.editarVenda, { data: f.data(v.data) })}
                              onClick={() => { setAviso(null); setEditando(v.id); }}>
                        {d.comum.editar}
                      </button>
                      <BotaoExcluir action={excluirVenda} id={v.id} projetoId={projetoId}
                                    confirmacao={fmtTexto(t.excluirConfirma, { data: f.data(v.data) })} rotulo={d.comum.excluir} pedirPin={pedirPin} />
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FormEdicao({ venda: v, projetoId, moeda, aoCancelar, aoSalvar, pedirPin }:
  { venda: Venda; projetoId: string; moeda: Moeda; aoCancelar: () => void; aoSalvar: (msg: string) => void; pedirPin: boolean }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const [estado, formAction] = useAcaoFormulario(atualizarVenda);
  const [vol, setVol] = useState(Number(v.volume));
  const [preco, setPreco] = useState(Number(v.preco_unitario));
  const ultimaSalva = useRef(0);

  // Fecha a linha assim que a action confirma; o ref evita repetir a cada render.
  useEffect(() => {
    if (estado.versao > ultimaSalva.current) {
      ultimaSalva.current = estado.versao;
      if (estado.sucesso) aoSalvar(estado.sucesso);
    }
  });

  // Unidade salva que não está na lista (importada ou digitada antes): vira opção extra.
  const unidades = (UNIDADES_VOLUME as readonly string[]).includes(v.unidade)
    ? UNIDADES_VOLUME : [v.unidade, ...UNIDADES_VOLUME];

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="projeto_id" value={projetoId} />
      <p className="text-stone sm:col-span-6">{fmtTexto(d.vendas.editando, { data: f.data(v.data) })}</p>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`data-${v.id}`}>{d.vendas.dataVenda}</label>
        <input id={`data-${v.id}`} name="data" type="date" required className="campo" defaultValue={v.data.slice(0, 10)} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`categoria-${v.id}`}>{d.vendas.categoriaReceita}</label>
        <select id={`categoria-${v.id}`} name="categoria" className="campo" defaultValue={v.categoria}>
          {CATEGORIAS_RECEITA.map((c) => <option key={c} value={c}>{d.enums.categoriaReceita[c]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`unidade-${v.id}`}>{d.vendas.unidadeVolume}</label>
        <select id={`unidade-${v.id}`} name="unidade" className="campo" defaultValue={v.unidade}>
          {unidades.map((u) => <option key={u} value={u}>{rotuloUnidade(u, d)}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`volume-${v.id}`}>{d.vendas.volume}</label>
        <input id={`volume-${v.id}`} name="volume" type="number" inputMode="decimal" min="0.001" step="any" required
               className="campo num" defaultValue={Number(v.volume)} onChange={(e) => setVol(Number(e.target.value))} />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`preco-${v.id}`}>{fmtTexto(d.vendas.preco, { moeda })}</label>
        <input id={`preco-${v.id}`} name="preco_unitario" type="number" inputMode="decimal" min="0.01" step="0.01" required
               className="campo num" defaultValue={Number(v.preco_unitario)} onChange={(e) => setPreco(Number(e.target.value))} />
      </div>
      {pedirPin && <div className="sm:col-span-3"><CampoPin id={v.id} /></div>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.comum.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
        <p className="text-stone">{d.vendas.receitaCalculada} <span className="num font-semibold text-navy">{f.moeda((vol || 0) * (preco || 0), moeda)}</span></p>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
