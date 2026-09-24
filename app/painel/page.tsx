import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PainelEmpresa } from "@/components/PainelEmpresa";
import {
  acessoSuspenso, ehMaster, listarCarteira, listarProjetos, minhaOrganizacao, obterPainelEmpresa,
} from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * O dashboard do ADM: a empresa inteira. O projeto é um campo do lançamento,
 * não um lugar onde ele precisa entrar — a visão por projeto é do investidor.
 */
export default async function PainelPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  // Sem empresa não há painel de empresa. /painel é a entrada de TODOS, então
  // quem não é ADM (investidor, membro de projeto, conta nova) segue para
  // /projetos, que já decide: investidor vai para a carteira, conta nova cria a
  // organização ali. Era esse o caminho antes de a entrada virar /painel.
  if (!org) redirect("/projetos");
  const [painel, suspenso] = await Promise.all([
    obterPainelEmpresa(org.organizacao.id), acessoSuspenso(),
  ]);
  const t = d.painel;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      {suspenso && (
        <p role="alert" className="mb-6 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3">
          <strong className="text-loss">{d.comum.acessoSuspenso}</strong>
          <span className="mt-1 block">{d.comum.acessoSuspensoTexto}</span>
        </p>
      )}
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: org.organizacao.nome })}</p>
      <PainelEmpresa painel={painel} />
    </Shell>
  );
}
