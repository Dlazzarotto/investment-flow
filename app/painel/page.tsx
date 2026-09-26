import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { PainelEmpresa } from "@/components/PainelEmpresa";
import { PrecosMercado } from "@/components/pesquisa/PrecosMercado";
import { pesquisaConfigurada } from "@/lib/ia/pesquisador";
import { ProjetosForaDaEmpresa } from "@/components/contratos/ProjetosForaDaEmpresa";
import {
  capitalPorProjeto, ehMaster, listarCarteira, listarCommodities, listarContratos, listarInstrumentos,
  listarMonetizacoes, listarCommoditiesPadrao, listarPesquisas, listarProjetos, listarRemuneracoes, minhaOrganizacao, obterCommoditiesPainel, obterPainelEmpresa, obterUsuario,
} from "@/lib/consultas";
import {
  alertasInstrumentos, baseDoProjeto, projetarRemuneracao, receitaDaEmpresa, resumoContratos, resumoMonetizacoes,
} from "@/lib/contratos";
import { hojeISO } from "@/lib/format";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * O dashboard do ADM: a empresa inteira. O projeto é um campo do lançamento,
 * não um lugar onde ele precisa entrar — a visão por projeto é do investidor.
 */
export default async function PainelPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org, usuario] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(), obterUsuario(),
  ]);
  // Sem empresa não há painel de empresa. /painel é a entrada de TODOS, então
  // quem não é ADM (investidor, membro de projeto, conta nova) segue para
  // /projetos, que já decide: investidor vai para a carteira, conta nova cria a
  // organização ali. Era esse o caminho antes de a entrada virar /painel.
  // O master da plataforma (0023) não é de empresa nenhuma: entra no painel dele,
  // não na tela que oferece "criar organização".
  if (!org) redirect(master ? "/master" : "/projetos");
  const orgId = org.organizacao.id;
  const projetosDaEmpresa = projetos.filter((p) => p.organizacao_id === orgId);
  const [painel, contratos, commodities, instrumentos, monetizacoes, remuneracoes, capital] = await Promise.all([
    obterPainelEmpresa(orgId), listarContratos(orgId), listarCommodities(orgId),
    listarInstrumentos(orgId), listarMonetizacoes(orgId), listarRemuneracoes(orgId),
    capitalPorProjeto(projetosDaEmpresa.map((p) => p.id)),
  ]);
  const resumo = resumoContratos(contratos);
  // Preços de mercado (0031): a escolha é de cada usuário; as pesquisas, da empresa.
  const [escolhidas, pesquisas, catalogo] = await Promise.all([obterCommoditiesPainel(), listarPesquisas(orgId, 300), listarCommoditiesPadrao()]);
  const gestao = remuneracoes.map((r) => {
    const projeto = projetosDaEmpresa.find((p) => p.id === r.projeto_id);
    return { moeda: projeto?.moeda ?? "USD" as const,
             ...projetarRemuneracao(r, baseDoProjeto(contratos, r.projeto_id, capital.get(r.projeto_id) ?? 0, projeto?.moeda)) };
  });
  const receita = receitaDaEmpresa(resumo, resumoMonetizacoes(monetizacoes, instrumentos), gestao);
  const alertas = alertasInstrumentos(instrumentos, hojeISO()).map((a) => {
    const i = instrumentos.find((x) => x.id === a.instrumento_id)!;
    return { ...a, contrato_id: i.contrato_id, rotulo: `${i.tipo.toUpperCase()} ${i.numero ?? ""}`.trim() };
  });
  const t = d.painel;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: org.organizacao.nome })}</p>
      <ProjetosForaDaEmpresa organizacaoId={org.organizacao.id}
                             projetos={projetos.filter((p) => !p.organizacao_id && p.owner_id === usuario?.id)} />
      <section className="secao">
        <h2>{d.precosPainel.titulo}</h2>
        <p className="mb-4 text-stone">{d.precosPainel.subtitulo}</p>
        <PrecosMercado organizacaoId={orgId} commodities={commodities} catalogo={catalogo} escolhidas={escolhidas}
                       pesquisas={pesquisas.filter((p) => p.modo === "bolsas" && escolhidas.includes(p.commodity_id))}
                       posicoes={resumo.volumes} configurada={pesquisaConfigurada()} />
      </section>
      <PainelEmpresa painel={painel} contratos={resumo} receita={receita} alertas={alertas}
                     projetosStatus={{
                       em_analise: projetosDaEmpresa.filter((p) => p.status === "em_analise").length,
                       em_andamento: projetosDaEmpresa.filter((p) => p.status === "em_andamento").length,
                       encerrado: projetosDaEmpresa.filter((p) => p.status === "encerrado").length,
                     }}
                     nomesProjeto={new Map(projetosDaEmpresa.map((p) => [p.id, p.nome]))}
                     nomesCommodity={new Map(commodities.map((c) => [c.id, c.nome]))} />
    </Shell>
  );
}
