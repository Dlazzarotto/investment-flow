"use client";
import { adicionarSocio, criarOrganizacao } from "@/app/actions/organizacao";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";

export function FormCriarOrganizacao() {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(criarOrganizacao);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.versao}>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="o_nome">{d.organizacao.nome}</label>
        <input id="o_nome" name="nome" required maxLength={120} className="campo" placeholder={d.organizacao.nomePlaceholder} />
      </div>
      <div className="flex items-end sm:col-span-2"><SubmitButton>{d.organizacao.criar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

export function FormAdicionarSocio({ organizacaoId }: { organizacaoId: string }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(adicionarSocio);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6" key={estado.versao}>
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="s_email">{d.organizacao.emailSocio}</label>
        <input id="s_email" name="email" type="email" required maxLength={320} autoComplete="off" className="campo" placeholder={d.membros.emailPlaceholder} />
      </div>
      <div className="flex items-end sm:col-span-2"><SubmitButton>{d.organizacao.adicionar}</SubmitButton></div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
