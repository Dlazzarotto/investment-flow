"use client";
import { useEffect, useRef, useState } from "react";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Vazio } from "@/components/ui/Vazio";
import { useAcaoFormulario, type EstadoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";

import type { ActionState } from "@/lib/types";
import { FormAcao } from "@/components/ui/FormAcao";

/**
 * Lista + formulário de um cadastro da empresa. Clientes e fornecedores têm a
 * mesma mecânica e campos diferentes — o que muda vem por `campos`, e o resto
 * (incluir, editar na linha, excluir, avisos) é igual nos dois.
 */
export interface Props<T> {
  itens: T[];
  organizacaoId: string;
  criar: (s: ActionState, fd: FormData) => Promise<ActionState>;
  atualizar: (s: ActionState, fd: FormData) => Promise<ActionState>;
  excluir: (s: ActionState, fd: FormData) => Promise<ActionState>;
  rotuloNovo: string;
  vazioTitulo: string;
  vazioTexto: string;
  confirmacao: (item: T) => string;
  /** Cabeçalho de cada linha, quando fechada. */
  resumo: (item: T) => React.ReactNode;
  campos: (item: T | undefined) => React.ReactNode;
  chave: (item: T) => string;
  nome: (item: T) => string;
}

export function Cadastro<T>(p: Props<T>) {
  const { d } = useI18n();
  const [editando, setEditando] = useState<string | null>(null);
  const [incluindo, setIncluindo] = useState(false);
  const [aviso, setAviso] = useState<ActionState | null>(null);

  function fechar(msg?: string) {
    setEditando(null); setIncluindo(false);
    if (msg) setAviso({ ok: true, sucesso: msg });
  }

  return (
    <>
      {aviso && <Mensagem estado={aviso} />}

      {p.itens.length === 0 && !incluindo ? (
        <Vazio titulo={p.vazioTitulo} texto={p.vazioTexto} />
      ) : (
        <ul className="grid gap-3">
          {p.itens.map((item) => {
            const id = p.chave(item);
            return (
              <li key={id} className={`rounded-md border bg-white p-4 ${editando === id ? "border-navy" : "border-stone-light"}`}>
                {editando === id ? (
                  <Formulario acao={p.atualizar} organizacaoId={p.organizacaoId} item={item} campos={p.campos}
                              chave={p.chave} aoCancelar={() => fechar()} aoSalvar={(m) => fechar(m)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* flex-1 + min-w-0 + basis-64: o resumo ocupa o que sobra (no celular, a linha toda,
                        e os botões descem) e NÃO cresce até a largura
                        de uma tabela aberta dentro dele (que então rola no próprio lugar). */}
                    <div className="min-w-0 flex-1 basis-64">{p.resumo(item)}</div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-quieto px-3"
                              aria-label={`${d.comum.editar} ${p.nome(item)}`}
                              onClick={() => { setAviso(null); setIncluindo(false); setEditando(id); }}>
                        {d.comum.editar}
                      </button>
                      <FormAcao action={p.excluir}
                            onSubmit={(e) => { if (!window.confirm(p.confirmacao(item))) e.preventDefault(); }}>
                        <input type="hidden" name="id" value={id} />
                        <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                      </FormAcao>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {incluindo ? (
        <div className="mt-4 rounded-md border border-navy bg-navy-soft/40 p-4">
          <Formulario acao={p.criar} organizacaoId={p.organizacaoId} campos={p.campos} chave={p.chave}
                      aoCancelar={() => fechar()} aoSalvar={(m) => fechar(m)} />
        </div>
      ) : (
        <button type="button" className="btn-quieto mt-4"
                onClick={() => { setAviso(null); setEditando(null); setIncluindo(true); }}>
          + {p.rotuloNovo}
        </button>
      )}
    </>
  );
}

function Formulario<T>({ acao, organizacaoId, item, campos, chave, aoCancelar, aoSalvar }: {
  acao: (s: ActionState, fd: FormData) => Promise<ActionState>;
  organizacaoId: string; item?: T;
  campos: (item: T | undefined) => React.ReactNode;
  chave: (item: T) => string;
  aoCancelar: () => void; aoSalvar: (msg: string) => void;
}) {
  const [estado, formAction] = useAcaoFormulario(acao);
  return <Campos key={estado.versao} estado={estado} formAction={formAction} organizacaoId={organizacaoId}
                 item={item} campos={campos} chave={chave} aoCancelar={aoCancelar} aoSalvar={aoSalvar} />;
}

function Campos<T>({ estado, formAction, organizacaoId, item, campos, chave, aoCancelar, aoSalvar }: {
  estado: EstadoFormulario; formAction: (fd: FormData) => void;
  organizacaoId: string; item?: T;
  campos: (item: T | undefined) => React.ReactNode;
  chave: (item: T) => string;
  aoCancelar: () => void; aoSalvar: (msg: string) => void;
}) {
  const { d } = useI18n();
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
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      {item && <input type="hidden" name="id" value={chave(item)} />}
      {campos(item)}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.cadastros.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoCancelar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

/** Rótulo de tipo em forma de selo, usado no resumo das linhas. */
export function Selos({ textos }: { textos: string[] }) {
  const { d } = useI18n();
  if (textos.length === 0) return <span className="text-stone">{d.cadastros.semTipo}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {textos.map((t) => (
        <span key={t} className="rounded bg-navy-soft px-2 py-0.5 text-sm text-navy">{t}</span>
      ))}
    </span>
  );
}

