"use client";
import { atualizarFornecedor, criarFornecedor, excluirFornecedor } from "@/app/actions/cadastros";
import { Cadastro, Selos } from "./Cadastro";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { GRUPOS_CUSTO, MODAIS_ETAPA, type Fornecedor } from "@/lib/types";

export function ListaFornecedores({ fornecedores, organizacaoId }:
  { fornecedores: Fornecedor[]; organizacaoId: string }) {
  const { d } = useI18n();
  const t = d.cadastros;

  return (
    <Cadastro<Fornecedor>
      itens={fornecedores} organizacaoId={organizacaoId}
      criar={criarFornecedor} atualizar={atualizarFornecedor} excluir={excluirFornecedor}
      rotuloNovo={t.novoFornecedor} vazioTitulo={t.semFornecedores} vazioTexto={t.semFornecedoresTexto}
      chave={(f) => f.id} nome={(f) => f.nome}
      confirmacao={(f) => fmtTexto(t.excluirFornecedor, { nome: f.nome })}
      resumo={(f) => (
        <>
          <p className="font-semibold text-navy">
            {f.nome}
            {!f.ativo && <span className="ml-2 rounded bg-stone-light px-2 py-0.5 text-sm text-stone">{t.inativo}</span>}
          </p>
          <div className="mt-1">
            <Selos textos={[d.enums.grupoCusto[f.servico], ...(f.modal ? [d.enums.modalEtapa[f.modal]] : [])]} />
          </div>
          <p className="mt-1 text-stone">{[f.pais, f.email, f.telefone].filter(Boolean).join(" · ")}</p>
        </>
      )}
      campos={(f) => {
        const id = f?.id ?? "novo";
        return (
          <>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`fnome-${id}`}>{t.nome}</label>
              <input id={`fnome-${id}`} name="nome" required maxLength={160} className="campo" defaultValue={f?.nome} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`fdoc-${id}`}>{t.documento}</label>
              <input id={`fdoc-${id}`} name="documento" maxLength={40} className="campo" defaultValue={f?.documento ?? ""} />
            </div>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`serv-${id}`}>{t.servico}</label>
              {/* Mesmo vocabulário do custeio: o lançamento herda daqui, sem tradução no meio. */}
              <select id={`serv-${id}`} name="servico" className="campo" defaultValue={f?.servico ?? "outros"}>
                {GRUPOS_CUSTO.map((g) => <option key={g} value={g}>{d.enums.grupoCusto[g]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`modal-${id}`}>{t.modal}</label>
              <select id={`modal-${id}`} name="modal" className="campo" defaultValue={f?.modal ?? ""}>
                <option value="">—</option>
                {MODAIS_ETAPA.map((m) => <option key={m} value={m}>{d.enums.modalEtapa[m]}</option>)}
              </select>
              <p className="mt-1 text-sm text-stone">{t.modalAjuda}</p>
            </div>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`femail-${id}`}>{t.email}</label>
              <input id={`femail-${id}`} name="email" type="email" maxLength={320} className="campo" defaultValue={f?.email ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`ftel-${id}`}>{t.telefone}</label>
              <input id={`ftel-${id}`} name="telefone" maxLength={40} className="campo" defaultValue={f?.telefone ?? ""} />
            </div>
            <div className="sm:col-span-1">
              <label className="rotulo" htmlFor={`fpais-${id}`}>{t.pais}</label>
              <input id={`fpais-${id}`} name="pais" maxLength={80} className="campo" defaultValue={f?.pais ?? ""} />
            </div>
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor={`fobs-${id}`}>{t.observacoes}</label>
              <input id={`fobs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={f?.observacoes ?? ""} />
            </div>
            <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
              <input type="checkbox" name="ativo" defaultChecked={f?.ativo ?? true} className="h-6 w-6 accent-navy" />
              <span>{t.ativo}</span>
            </label>
          </>
        );
      }}
    />
  );
}
