import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProjetosForaDaEmpresa } from "@/components/contratos/ProjetosForaDaEmpresa";
import { FormContrato, type ValoresContrato } from "@/components/contratos/FormContrato";
import { criarContrato } from "@/app/actions/contratos";
import {
  ehMaster, listarCarteira, listarClientes, listarCommodities, listarItensEstimativa, listarProjetos, minhaOrganizacao,
  obterEstimativa, obterUsuario,
} from "@/lib/consultas";
import { calcularCusteio } from "@/lib/custeio";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const normal = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Novo contrato. Com `?estimativa=<id>`, nasce da PROPOSTA: volume, moeda,
 * unidade, projeto e o preço que o custeio reverso encontrou já vêm preenchidos,
 * e o contrato guarda de qual estimativa veio.
 */
export default async function NovoContratoPage({ searchParams }: { searchParams: { estimativa?: string; direcao?: string } }) {
  const { d } = obterD();
  const t = d.contratos;
  const direcao = searchParams.direcao === "compra" ? "compra" as const : "venda" as const;
  const [projetos, carteira, master, org, usuario] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(), obterUsuario(),
  ]);
  if (!org) redirect("/projetos");
  const orgId = org.organizacao.id;
  const [clientes, commodities] = await Promise.all([listarClientes(orgId), listarCommodities(orgId)]);
  if (clientes.length === 0 || commodities.length === 0) redirect(direcao === "compra" ? "/compras" : "/vendas");

  let valores: ValoresContrato = { direcao };
  let origem: string | null = null;
  if (searchParams.estimativa) {
    const est = await obterEstimativa(searchParams.estimativa);
    const itens = await listarItensEstimativa(est.id);
    const r = calcularCusteio(itens, {
      volume_total: Number(est.volume_total), producao_diaria: Number(est.producao_diaria),
      dias_mes: est.dias_mes, margem_alvo_pct: Number(est.margem_alvo_pct),
    });
    // Na estimativa, cliente e commodity são texto livre: casa pelo nome, se houver cadastro igual.
    const cliente = clientes.find((c) => normal(c.nome) === normal(est.cliente));
    const commodity = commodities.find((c) => normal(c.nome) === normal(est.commodity));
    valores = {
      estimativa_id: est.id, projeto_id: est.projeto_id, direcao: "venda", volume: Number(est.volume_total),
      unidade: est.unidade, moeda: est.moeda, tipo_preco: "fixo",
      preco_fixo: r.preco === null ? null : Math.round(r.preco * 100) / 100,
      comprador_id: cliente?.id, commodity_id: commodity?.id,
    };
    origem = est.nome;
  }

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      <Link href={direcao === "compra" ? "/compras" : "/vendas"} className="text-navy underline">← {t.voltar}</Link>
      <h1 className="mt-2 text-2xl">{t.novo}</h1>
      <p className="mt-1 text-stone">{origem ? `${t.daProposta}: ${origem}` : t.novoSubtitulo}</p>
      <ProjetosForaDaEmpresa organizacaoId={orgId}
                             projetos={projetos.filter((p) => !p.organizacao_id && p.owner_id === usuario?.id)} />
      <div className="mt-6 max-w-4xl">
        <FormContrato acao={criarContrato} organizacaoId={orgId} clientes={clientes} commodities={commodities}
                      projetos={projetos.filter((p) => p.organizacao_id === orgId)} valores={valores}
                      rotuloSalvar={t.criar} />
      </div>
    </Shell>
  );
}
