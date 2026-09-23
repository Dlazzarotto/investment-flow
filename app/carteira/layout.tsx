import { Shell } from "@/components/Shell";
import { ehMaster, listarCarteira, listarProjetos } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const [projetos, carteira, master] = await Promise.all([listarProjetos(), listarCarteira(), ehMaster()]);
  return <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master}>{children}</Shell>;
}
