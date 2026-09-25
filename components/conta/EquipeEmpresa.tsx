"use client";
import { removerSocio } from "@/app/actions/organizacao";
import { FormAdicionarSocio } from "@/components/forms/FormOrganizacao";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { OrganizacaoMembro } from "@/lib/types";

/**
 * Quem administra a empresa: enxerga tudo dela e ocupa um assento do plano.
 * Remover só aparece com mais de um (o banco recusa deixar a empresa sem
 * ninguém) e devolve a mensagem na linha em vez de derrubar a página.
 */
export function EquipeEmpresa({ organizacaoId, membros, emailAtual }:
  { organizacaoId: string; membros: OrganizacaoMembro[]; emailAtual: string }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.organizacao;
  return (
    <>
      <ul className="grid gap-2">
        {membros.map((m) => (
          <Linha key={m.id} membro={m} voce={m.email_normalizado === emailAtual} podeRemover={membros.length > 1}
                 data={f.data(m.criado_em)} confirmacao={fmtTexto(t.removerConfirma, { email: m.email })} />
        ))}
      </ul>
      <div className="mt-6"><FormAdicionarSocio organizacaoId={organizacaoId} /></div>
    </>
  );
}

function Linha({ membro: m, voce, podeRemover, data, confirmacao }:
  { membro: OrganizacaoMembro; voce: boolean; podeRemover: boolean; data: string; confirmacao: string }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(removerSocio);
  return (
    <li className={`rounded-md border p-3 ${voce ? "border-navy bg-navy-soft/60" : "border-stone-light bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            <span className="break-all">{m.email}</span>
            {voce && <span className="ml-2 whitespace-nowrap text-sm text-stone">({d.organizacao.voce})</span>}
          </p>
          <p className="text-sm text-stone">{data}</p>
        </div>
        {podeRemover && (
          <form action={formAction} onSubmit={(e) => { if (!window.confirm(confirmacao)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" className="btn-perigo px-3">{d.comum.remover}</button>
          </form>
        )}
      </div>
      <Mensagem estado={estado} />
    </li>
  );
}
