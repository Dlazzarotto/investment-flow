import { Shell } from "@/components/Shell";
import { ehMaster, listarCarteira, listarProjetos, minhaOrganizacao } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  return <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>{children}</Shell>;
}
