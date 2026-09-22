"use client";
import { useEffect, useRef, useState } from "react";
import { atualizarDespesa, excluirDespesa } from "@/app/actions/despesas";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Vazio } from "@/components/ui/Vazio";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { CATEGORIAS_DESPESA, type ActionState, type Despesa, type Moeda } from "@/lib/types";

/** Colunas da tabela; a de ações só existe para quem pode editar. */
const COLUNAS_BASE = 4;

/** Tabela de despesas com edição na própria linha (uma por vez). */
export function TabelaDespesas({ despesas, projetoId, moeda, editavel }:
  { despesas: Despesa[]; projetoId: string; moeda: Moeda; editavel: boolean }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.despesas;
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<ActionState | null>(null);

  if (despesas.length === 0) return <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} />;

  return (
    <>
      {aviso && <Mensagem estado={aviso} />}
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th>{d.comum.data}</th><th>{t.descricao}</th><th>{d.comum.categoria}</th>
              <th className="num">{d.comum.total}</th>{editavel && <th>{d.comum.acoes}</th>}
            </tr>
          </thead>
          <tbody>
            {despesas.map((x) => editavel && editando === x.id ? (
              <tr key={x.id} className="bg-navy-soft/50">
                <td colSpan={COLUNAS_BASE + 1} className="py-4">
                  {/* A tabela pode ser mais larga que a tela; o wrapper prende o formulário
                      à esquerda da área rolável para não precisar rolar na horizontal. */}
                  <div className="sticky left-0 w-[calc(100vw-2rem)] max-w-full">
                    <FormEdicao
                      despesa={x} projetoId={projetoId} moeda={moeda}
                      aoCancelar={() => setEditando(null)}
                      aoSalvar={(msg) => { setEditando(null); setAviso({ ok: true, sucesso: msg }); }}
                    />
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={x.id}>
                <td className="whitespace-nowrap">{f.data(x.data)}</td>
                <td className="font-medium">{x.descricao}</td>
                <td>{d.enums.categoriaDespesa[x.categoria]}</td>
                <td className="num font-semibold">{f.moeda(Number(x.valor), moeda)}</td>
                {editavel && (
                  <td>
                    <div className="flex gap-2">
                      <button type="button" className="btn-quieto px-3"
                              aria-label={fmtTexto(t.editarDespesa, { descricao: x.descricao })}
                              onClick={() => { setAviso(null); setEditando(x.id); }}>
                        {d.comum.editar}
                      </button>
                      <BotaoExcluir action={excluirDespesa} id={x.id} projetoId={projetoId}
                                    confirmacao={fmtTexto(t.excluirConfirma, { descricao: x.descricao })} rotulo={d.comum.excluir} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FormEdicao({ despesa: x, projetoId, moeda, aoCancelar, aoSalvar }:
  { despesa: Despesa; projetoId: string; moeda: Moeda; aoCancelar: () => void; aoSalvar: (msg: string) => void }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(atualizarDespesa);
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
      <input type="hidden" name="id" value={x.id} />
      <input type="hidden" name="projeto_id" value={projetoId} />
      <p className="text-stone sm:col-span-6">{fmtTexto(d.despesas.editando, { descricao: x.descricao })}</p>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor={`descricao-${x.id}`}>{d.despesas.descricao}</label>
        <input id={`descricao-${x.id}`} name="descricao" required maxLength={160} className="campo" defaultValue={x.descricao} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`categoria-${x.id}`}>{d.comum.categoria}</label>
        <select id={`categoria-${x.id}`} name="categoria" className="campo" defaultValue={x.categoria}>
          {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{d.enums.categoriaDespesa[c]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`valor-${x.id}`}>{fmtTexto(d.despesas.valor, { moeda })}</label>
        <input id={`valor-${x.id}`} name="valor" type="number" inputMode="decimal" min="0.01" step="0.01" required
               className="campo num" defaultValue={Number(x.valor)} />
      </div>
      <div className="sm:col-span-3">
        <label className="rotulo" htmlFor={`data-${x.id}`}>{d.despesas.dataDespesa}</label>
        <input id={`data-${x.id}`} name="data" type="date" required className="campo" defaultValue={x.data.slice(0, 10)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.comum.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
