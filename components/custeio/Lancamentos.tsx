"use client";
import { useState } from "react";
import { excluirItem } from "@/app/actions/custeio";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Mensagem } from "@/components/ui/Mensagem";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { ehPercentual, type ItemCalculado, type ResultadoCusteio } from "@/lib/custeio";
import type { ActionState, EstimativaCusto, EstimativaItem, ProjetoEtapa } from "@/lib/types";
import { FormItem } from "./FormItem";

interface Props {
  estimativa: EstimativaCusto;
  etapas: ProjetoEtapa[];
  itens: EstimativaItem[];
  resultado: ResultadoCusteio;
  projetoId: string;
  editavel: boolean;
  pedirPin?: boolean;
}

/** Um bloco por etapa da cadeia, mais o balde do que não pertence a trecho nenhum. */
export function Lancamentos({ estimativa, etapas, itens, resultado, projetoId, editavel, pedirPin = false }: Props) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.custeio;
  const [editando, setEditando] = useState<string | null>(null);
  const [incluindoEm, setIncluindoEm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<ActionState | null>(null);

  const calculados = new Map(resultado.itens.map((i) => [i.id, i]));
  const porEtapa = new Map(resultado.porEtapa.map((e) => [e.etapaId ?? "", e.valor]));

  const baldes: { chave: string; etapa: ProjetoEtapa | null; itens: EstimativaItem[] }[] = [
    ...etapas.map((e) => ({ chave: e.id, etapa: e, itens: itens.filter((i) => i.etapa_id === e.id) })),
    { chave: "", etapa: null, itens: itens.filter((i) => !i.etapa_id) },
  ];

  function fechar(msg?: string) {
    setEditando(null); setIncluindoEm(null);
    if (msg) setAviso({ ok: true, sucesso: msg });
  }

  return (
    <>
      {aviso && <Mensagem estado={aviso} />}
      <div className="grid gap-6">
        {baldes.map(({ chave, etapa, itens: doBalde }, i) => (
          <section key={chave} className="rounded-md border border-stone-light bg-white p-4">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg text-navy">
                  {etapa ? `${i + 1}. ${etapa.nome}` : t.semEtapa}
                </h3>
                <p className="text-stone">
                  {etapa
                    ? [d.enums.modalEtapa[etapa.modal], [etapa.origem, etapa.destino].filter(Boolean).join(" → "), etapa.pais]
                        .filter(Boolean).join(" · ")
                    : t.semEtapaAjuda}
                </p>
              </div>
              <p className="text-stone">
                {t.subtotalEtapa}:{" "}
                <span className="num font-semibold text-navy">
                  {f.moeda(porEtapa.get(chave) ?? 0, estimativa.moeda)}
                </span>
              </p>
            </header>

            {doBalde.length === 0 ? (
              <p className="text-stone">{t.semItens}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>{t.itemNome}</th><th>{t.grupo}</th><th>{t.driver}</th>
                      <th className="num">{d.comum.total}</th>
                      <th className="num">{fmtTexto(t.porUnidade, { unidade: rotuloUnidade(estimativa.unidade, d) })}</th>
                      {editavel && <th>{d.comum.acoes}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {doBalde.map((x) => editavel && editando === x.id ? (
                      <tr key={x.id} className="bg-navy-soft/50">
                        <td colSpan={editavel ? 6 : 5} className="py-4">
                          <div className="sticky left-0 w-[calc(100vw-2rem)] max-w-full">
                            <FormItem item={x} estimativaId={estimativa.id} projetoId={projetoId} etapaId={etapa?.id ?? null}
                                      moeda={estimativa.moeda} unidade={estimativa.unidade} pedirPin={pedirPin}
                                      aoCancelar={() => fechar()} aoSalvar={(m) => fechar(m)} />
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <Linha key={x.id} item={x} calculado={calculados.get(x.id)} estimativa={estimativa}
                             projetoId={projetoId} editavel={editavel} pedirPin={pedirPin}
                             aoEditar={() => { setAviso(null); setIncluindoEm(null); setEditando(x.id); }} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {editavel && (incluindoEm === chave ? (
              <div className="mt-4 rounded-md border border-navy bg-navy-soft/40 p-4">
                <FormItem estimativaId={estimativa.id} projetoId={projetoId} etapaId={etapa?.id ?? null}
                          moeda={estimativa.moeda} unidade={estimativa.unidade} pedirPin={false}
                          aoCancelar={() => fechar()} aoSalvar={(m) => fechar(m)} />
              </div>
            ) : (
              <button type="button" className="btn-quieto mt-4"
                      onClick={() => { setAviso(null); setEditando(null); setIncluindoEm(chave); }}>
                + {t.novoItem}
              </button>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

function Linha({ item: x, calculado, estimativa, projetoId, editavel, pedirPin, aoEditar }:
  { item: EstimativaItem; calculado?: ItemCalculado; estimativa: EstimativaCusto; projetoId: string;
    editavel: boolean; pedirPin: boolean; aoEditar: () => void }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.custeio;
  const pct = ehPercentual(x.driver);
  const qtd = Number(x.quantidade);

  return (
    <tr>
      <td className="font-medium">
        {x.nome}
        {x.origem === "ia" && (
          <span className="ml-2 whitespace-nowrap rounded bg-orange/15 px-2 py-0.5 text-sm text-orange-deep">{t.marcadoIA}</span>
        )}
        {x.capacidade && (
          <span className="block text-sm text-stone">
            {fmtTexto(t.capacidade, { unidade: rotuloUnidade(estimativa.unidade, d) })}: {f.numero(Number(x.capacidade))}
          </span>
        )}
      </td>
      <td>{d.enums.grupoCusto[x.grupo]}</td>
      <td>
        {d.enums.driverCusto[x.driver]}
        {!pct && qtd !== 1 && <span className="block text-sm text-stone">× {f.numero(qtd)}</span>}
      </td>
      <td className="num">{pct ? `${f.numero(Number(x.valor))} %` : f.moeda(Number(x.valor), estimativa.moeda)}</td>
      <td className="num font-semibold">
        {calculado?.porUnidade !== null && calculado?.porUnidade !== undefined
          ? f.moeda(calculado.porUnidade, estimativa.moeda)
          : <span className="text-loss">{avisoImpedimento(calculado, d)}</span>}
      </td>
      {editavel && (
        <td>
          <div className="flex gap-2">
            <button type="button" className="btn-quieto px-3" aria-label={fmtTexto(t.editarItem, { nome: x.nome })} onClick={aoEditar}>
              {d.comum.editar}
            </button>
            <BotaoExcluir action={excluirItem} id={x.id} projetoId={projetoId} pedirPin={pedirPin}
                          confirmacao={fmtTexto(t.itemExcluirConfirma, { nome: x.nome })} rotulo={d.comum.excluir} />
          </div>
        </td>
      )}
    </tr>
  );
}

/** Percentuais não têm custo por tonelada próprio; o resto mostra o motivo de ter ficado de fora. */
function avisoImpedimento(c: ItemCalculado | undefined, d: ReturnType<typeof useI18n>["d"]): string {
  if (!c) return "—";
  if (c.impedimento === "sem_producao_diaria") return d.custeio.semProducaoDiaria;
  if (c.impedimento === "sem_capacidade") return d.custeio.semCapacidade;
  return "—";
}
