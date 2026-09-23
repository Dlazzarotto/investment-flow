import { Shell } from "@/components/Shell";
import { listarCarteira, listarProjetos } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const [projetos, carteira] = await Promise.all([listarProjetos(), listarCarteira()]);
  return <Shell projetos={projetos} temCarteira={carteira.length > 0}>{children}</Shell>;
}
