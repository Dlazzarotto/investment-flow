import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { FormEmpresa } from "@/components/master/FormEmpresa";
import { PainelMaster } from "@/components/master/PainelMaster";
import { ehMaster, listarEmpresas, listarFaturas, listarProjetos, obterPainelPlataforma } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Painel da administração da plataforma: liberar empresas e cuidar do contrato
 * de cada uma. Quem não é master recebe 404 — dizer "sem permissão" já confirma
 * que a área existe.
 */
export default async function MasterPage() {
  const { d } = obterD();
  if (!(await ehMaster())) notFound();

  const [empresas, projetos, painel, faturas] = await Promise.all([
    listarEmpresas(), listarProjetos(), obterPainelPlataforma(), listarFaturas(),
  ]);
  const t = d.master;

  return (
    <Shell projetos={projetos} ehMaster>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{t.subtitulo}</p>

      <PainelMaster painel={painel} empresas={empresas} faturas={faturas} />

      <section className="secao">
        <h2>{t.nova}</h2>
        <FormEmpresa />
      </section>
    </Shell>
  );
}
