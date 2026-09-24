import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { FormContrato } from "@/components/contratos/FormContrato";
import { SeloStatus } from "@/components/contratos/SeloStatus";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { atualizarContrato, excluirContrato } from "@/app/actions/contratos";
import {
  ehMaster, listarCarteira, listarClientes, listarCommodities, listarProjetos, minhaOrganizacao, obterContrato,
} from "@/lib/consultas";
import { comissaoAgente, faixaVolume, precoUnitario, valorContrato } from "@/lib/contratos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContratoPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.contratos;
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  if (!org) redirect("/projetos");
  const orgId = org.organizacao.id;
  const contrato = await obterContrato(params.id);
  if (contrato.organizacao_id !== orgId) notFound();
  const [clientes, commodities] = await Promise.all([listarClientes(orgId), listarCommodities(orgId)]);

  const contraparte = clientes.find((c) => c.id === contrato.contraparte_id);
  const commodity = commodities.find((c) => c.id === contrato.commodity_id);
  const preco = precoUnitario(contrato);
  const valor = valorContrato(contrato);
  const comissao = comissaoAgente(contrato);
  const faixa = faixaVolume(contrato);
  const unidade = rotuloUnidade(contrato.unidade, d);
  const titulo = contrato.numero ?? t.semNumero;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      <Link href="/contratos" className="text-navy underline">← {t.voltar}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl">{titulo}</h1>
        <SeloStatus status={contrato.status} rotulo={d.enums.statusContrato[contrato.status]} />
      </div>
      <p className="mt-1 text-stone">
        {[d.enums.direcaoContrato[contrato.direcao], d.enums.papelContrato[contrato.papel], contraparte?.nome,
          commodity?.nome, contrato.incoterm].filter(Boolean).join(" · ")}
      </p>

      <section className="secao">
        <h2>{t.resumo}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cartao rotulo={t.volume} valor={`${f.numero(Number(contrato.volume), 0)} ${unidade}`}
                  nota={Number(contrato.tolerancia_pct) > 0
                    ? fmtTexto(t.faixa, { min: f.numero(faixa.min, 0), max: f.numero(faixa.max, 0) }) : undefined} />
          <Cartao rotulo={t.precoUnitario} valor={preco === null ? t.valorAConfirmar : f.moeda(preco, contrato.moeda)}
                  nota={contrato.tipo_preco === "formula" ? contrato.indice ?? undefined : undefined} />
          <Cartao rotulo={t.valorProjetado} valor={valor === null ? t.valorAConfirmar : f.moeda(valor, contrato.moeda)}
                  destaque={contrato.papel === "principal"} />
          {contrato.papel === "agente" ? (
            <Cartao rotulo={t.comissao} valor={comissao === null ? t.valorAConfirmar : f.moeda(comissao, contrato.moeda)} destaque />
          ) : (
            <Cartao rotulo={t.formaPagamento}
                    valor={d.enums.formaPagamento[contrato.forma_pagamento]}
                    nota={contrato.pct_provisoria !== null
                      ? fmtTexto(t.provisoriaNota, { pct: f.numero(Number(contrato.pct_provisoria), 0) }) : undefined} />
          )}
        </div>
        {/* A etapa 2 traz os embarques; até lá o valor é o PACTUADO, e a tela diz isso. */}
        <p className="mt-3 text-sm text-stone">{t.projecaoAviso}</p>
      </section>

      <section className="secao max-w-4xl">
        <h2>{t.editar}</h2>
        <FormContrato acao={atualizarContrato} organizacaoId={orgId} clientes={clientes} commodities={commodities}
                      projetos={projetos.filter((p) => p.organizacao_id === orgId)} valores={contrato}
                      rotuloSalvar={d.comum.salvar} />
      </section>

      <section className="secao">
        <BotaoExcluir action={excluirContrato} id={contrato.id} projetoId=""
                      confirmacao={fmtTexto(t.excluirConfirma, { numero: titulo })} rotulo={t.excluir} />
      </section>
    </Shell>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false }: { rotulo: string; valor: string; nota?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${destaque ? "border-navy bg-navy-soft" : "border-stone-light bg-white"}`}>
      <p className="text-sm text-stone">{rotulo}</p>
      <p className="num mt-1 text-lg font-semibold text-navy">{valor}</p>
      {nota && <p className="mt-1 text-sm text-stone">{nota}</p>}
    </div>
  );
}
