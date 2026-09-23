"use client";
import { atualizarCliente, criarCliente, excluirCliente } from "@/app/actions/cadastros";
import { Cadastro, Selos } from "./Cadastro";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { TIPOS_CLIENTE, type Cliente } from "@/lib/types";

export function ListaClientes({ clientes, organizacaoId }: { clientes: Cliente[]; organizacaoId: string }) {
  const { d } = useI18n();
  const t = d.cadastros;

  return (
    <Cadastro<Cliente>
      itens={clientes} organizacaoId={organizacaoId}
      criar={criarCliente} atualizar={atualizarCliente} excluir={excluirCliente}
      rotuloNovo={t.novoCliente} vazioTitulo={t.semClientes} vazioTexto={t.semClientesTexto}
      chave={(c) => c.id} nome={(c) => c.nome}
      confirmacao={(c) => fmtTexto(t.excluirCliente, { nome: c.nome })}
      resumo={(c) => (
        <>
          <p className="font-semibold text-navy">
            {c.nome}
            {!c.ativo && <span className="ml-2 rounded bg-stone-light px-2 py-0.5 text-sm text-stone">{t.inativo}</span>}
          </p>
          <div className="mt-1"><Selos textos={(c.tipos ?? []).map((x) => d.enums.tipoCliente[x])} /></div>
          <p className="mt-1 text-stone">
            {[c.pais, c.email, c.telefone].filter(Boolean).join(" · ")}
          </p>
        </>
      )}
      campos={(c) => {
        const id = c?.id ?? "novo";
        return (
          <>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`nome-${id}`}>{t.nome}</label>
              <input id={`nome-${id}`} name="nome" required maxLength={160} className="campo" defaultValue={c?.nome} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`doc-${id}`}>{t.documento}</label>
              <input id={`doc-${id}`} name="documento" maxLength={40} className="campo" defaultValue={c?.documento ?? ""} />
            </div>
            <fieldset className="sm:col-span-6">
              <legend className="rotulo">{t.tipos}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {TIPOS_CLIENTE.map((x) => (
                  <label key={x} className="flex min-h-touch items-center gap-2">
                    <input type="checkbox" name="tipos" value={x} className="h-6 w-6 accent-navy"
                           defaultChecked={(c?.tipos ?? []).includes(x)} />
                    <span>{d.enums.tipoCliente[x]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-sm text-stone">{t.tiposAjuda}</p>
            </fieldset>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`email-${id}`}>{t.email}</label>
              <input id={`email-${id}`} name="email" type="email" maxLength={320} className="campo" defaultValue={c?.email ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`tel-${id}`}>{t.telefone}</label>
              <input id={`tel-${id}`} name="telefone" maxLength={40} className="campo" defaultValue={c?.telefone ?? ""} />
            </div>
            <div className="sm:col-span-1">
              <label className="rotulo" htmlFor={`pais-${id}`}>{t.pais}</label>
              <input id={`pais-${id}`} name="pais" maxLength={80} className="campo" defaultValue={c?.pais ?? ""} />
            </div>
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor={`end-${id}`}>{t.endereco}</label>
              <input id={`end-${id}`} name="endereco" maxLength={300} className="campo" defaultValue={c?.endereco ?? ""} />
            </div>
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor={`obs-${id}`}>{t.observacoes}</label>
              <input id={`obs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={c?.observacoes ?? ""} />
            </div>
            <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
              <input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} className="h-6 w-6 accent-navy" />
              <span>{t.ativo}</span>
            </label>
          </>
        );
      }}
    />
  );
}
