import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ehMaster, listarCarteira, listarProjetos, minhaOrganizacao, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function ProjetoLayout({ children, params }:
  { children: React.ReactNode; params: { id: string } }) {
  const [projetos, projeto, papel, carteira, master, org] = await Promise.all([
    listarProjetos(), obterProjeto(params.id), obterPapel(params.id), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  // Investidor só lê o que é dele: a visão dele é a carteira, não o painel operacional.
  if (permissoes(papel).ehInvestidor) redirect(`/carteira/${projeto.id}`);
  return (
    <Shell projetos={projetos} projetoAtual={projeto} verInvestimentos={permissoes(papel).verInvestimentos}
           temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      {children}
    </Shell>
  );
}
