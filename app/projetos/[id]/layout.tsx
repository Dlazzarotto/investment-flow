import { Shell } from "@/components/Shell";
import { listarProjetos, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function ProjetoLayout({ children, params }:
  { children: React.ReactNode; params: { id: string } }) {
  const [projetos, projeto, papel] = await Promise.all([
    listarProjetos(), obterProjeto(params.id), obterPapel(params.id),
  ]);
  return (
    <Shell projetos={projetos} projetoAtual={projeto} verInvestimentos={permissoes(papel).verInvestimentos}>
      {children}
    </Shell>
  );
}
