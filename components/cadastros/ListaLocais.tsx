"use client";
import { atualizarLocal, criarLocal, excluirLocal } from "@/app/actions/cadastros";
import { Cadastro } from "./Cadastro";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { TIPOS_LOCAL, type Local } from "@/lib/types";

/** Minas, portos, terminais: cadastrados uma vez, escolhidos em todo contrato. */
export function ListaLocais({ locais, organizacaoId }: { locais: Local[]; organizacaoId: string }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.cadastros;
  return (
    <Cadastro<Local>
      itens={locais} organizacaoId={organizacaoId}
      criar={criarLocal} atualizar={atualizarLocal} excluir={excluirLocal}
      rotuloNovo={t.novoLocal} vazioTitulo={t.semLocais} vazioTexto={t.semLocaisTexto}
      chave={(l) => l.id} nome={(l) => l.nome}
      confirmacao={(l) => fmtTexto(t.excluirLocal, { nome: l.nome })}
      resumo={(l) => (
        <>
          <p className="font-semibold text-navy">
            {l.nome}
            {!l.ativo && <span className="ml-2 rounded bg-stone-light px-2 py-0.5 text-sm text-stone">{t.inativo}</span>}
          </p>
          <p className="mt-1 text-stone">
            {[d.enums.tipoLocal[l.tipo], [l.regiao, l.pais].filter(Boolean).join(", "), l.unlocode,
              l.calado_max_m !== null ? `${t.caladoMax}: ${f.numero(Number(l.calado_max_m), 2)}` : null]
              .filter(Boolean).join(" · ")}
          </p>
        </>
      )}
      campos={(l) => {
        const id = l?.id ?? "novo";
        return (
          <>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`lnome-${id}`}>{t.nome}</label>
              <input id={`lnome-${id}`} name="nome" required maxLength={160} className="campo" defaultValue={l?.nome} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`ltipo-${id}`}>{t.tipoLocal}</label>
              <select id={`ltipo-${id}`} name="tipo" className="campo" defaultValue={l?.tipo ?? "porto"}>
                {TIPOS_LOCAL.map((x) => <option key={x} value={x}>{d.enums.tipoLocal[x]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`lpais-${id}`}>{t.pais}</label>
              <input id={`lpais-${id}`} name="pais" maxLength={80} className="campo" defaultValue={l?.pais ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`lreg-${id}`}>{t.regiao}</label>
              <input id={`lreg-${id}`} name="regiao" maxLength={120} className="campo" defaultValue={l?.regiao ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`lun-${id}`}>{t.unlocode}</label>
              <input id={`lun-${id}`} name="unlocode" maxLength={6} className="campo uppercase" defaultValue={l?.unlocode ?? ""}
                     placeholder="BR SSZ" />
              <p className="mt-1 text-sm text-stone">{t.unlocodeAjuda}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`lcal-${id}`}>{t.caladoMax}</label>
              <input id={`lcal-${id}`} name="calado_max_m" type="number" inputMode="decimal" step="0.01" min="0" max="40"
                     className="campo num" defaultValue={l?.calado_max_m ?? ""} />
              <p className="mt-1 text-sm text-stone">{t.caladoAjuda}</p>
            </div>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`lobs-${id}`}>{t.observacoes}</label>
              <input id={`lobs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={l?.observacoes ?? ""} />
            </div>
            <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
              <input type="checkbox" name="ativo" defaultChecked={l?.ativo ?? true} className="h-6 w-6 accent-navy" />
              <span>{t.ativo}</span>
            </label>
          </>
        );
      }}
    />
  );
}
