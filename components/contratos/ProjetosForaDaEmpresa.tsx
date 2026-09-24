import { trazerProjetosParaEmpresa } from "@/app/actions/contratos";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import type { Projeto } from "@/lib/types";

/**
 * Aviso para projetos do usuário criados antes de a empresa existir: sem empresa,
 * eles não entram no painel nem podem ir num contrato. Um clique os traz.
 */
export function ProjetosForaDaEmpresa({ projetos, organizacaoId }: { projetos: Projeto[]; organizacaoId: string }) {
  const { d } = obterD();
  const t = d.contratos;
  if (projetos.length === 0) return null;
  return (
    <form action={trazerProjetosParaEmpresa} className="mt-4 rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <p className="font-semibold text-navy">{fmtTexto(t.foraDaEmpresaTitulo, { n: projetos.length })}</p>
      <p className="mt-1">{projetos.map((p) => p.nome).join(", ")}</p>
      <p className="mt-1 text-stone">{t.foraDaEmpresaTexto}</p>
      <div className="mt-3"><SubmitButton className="btn-navy">{t.trazerParaEmpresa}</SubmitButton></div>
    </form>
  );
}
