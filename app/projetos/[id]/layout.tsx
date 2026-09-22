import { Shell } from "@/components/Shell";
import { listarProjetos, obterProjeto } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function ProjetoLayout({ children, params }:
  { children: React.ReactNode; params: { id: string } }) {
  const [projetos, projeto] = await Promise.all([listarProjetos(), obterProjeto(params.id)]);
  return <Shell projetos={projetos} projetoAtual={projeto}>{children}</Shell>;
}
