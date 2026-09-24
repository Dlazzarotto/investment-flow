import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProjetosForaDaEmpresa } from "@/components/contratos/ProjetosForaDaEmpresa";
import { FormContrato } from "@/components/contratos/FormContrato";
import { SeloStatus } from "@/components/contratos/SeloStatus";
import { Instrumentos } from "@/components/contratos/Instrumentos";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { atualizarContrato, excluirContrato } from "@/app/actions/contratos";
import {
  ehMaster, listarCarteira, listarClientes, listarCommodities, listarInstrumentos, listarMonetizacoes, listarPartes, listarProjetos,
  minhaOrganizacao, obterContrato, obterUsuario,
} from "@/lib/consultas";
import { alertasInstrumentos, comissaoAgente, faixaVolume, precoUnitario, valorContrato } from "@/lib/contratos";
import { hojeISO } from "@/lib/format";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContratoPage({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.contratos;
  const [projetos, carteira, master, org, usuario] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(), obterUsuario(),
  ]);
  if (!org) redirect("/projetos");
  const orgId = org.organizacao.id;
  const contrato = await obterContrato(params.id);
  if (contrato.organizacao_id !== orgId) notFound();
  const [clientes, commodities, todasPartes, todosInstrumentos, todasMonetizacoes] = await Promise.all([
    listarClientes(orgId), listarCommodities(orgId), listarPartes(orgId), listarInstrumentos(orgId), listarMonetizacoes(orgId),
  ]);
  const partes = todasPartes.filter((p) => p.contrato_id === contrato.id);
  const parte = (papel: "comprador" | "vendedor" | "financial_partner") => partes.find((p) => p.papel === papel)?.cliente_id ?? null;
  const nome = (id: string | null) => (id ? clientes.find((c) => c.id === id)?.nome : undefined);
  const instrumentos = todosInstrumentos.filter((i) => i.contrato_id === contrato.id);
  const monetizacoes = todasMonetizacoes.filter((m) => instrumentos.some((i) => i.id === m.instrumento_id));
  const projetosDaEmpresa = projetos.filter((p) => p.organizacao_id === orgId);
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
        {[contrato.papel === "agente" ? null : d.enums.direcaoContrato[contrato.direcao], d.enums.papelContrato[contrato.papel],
          commodity?.nome, contrato.incoterm,
          contrato.conta === "projeto" ? `${d.enums.contaContrato.projeto}: ${projetos.find((p) => p.id === contrato.projeto_id)?.nome ?? ""}` : null,
        ].filter(Boolean).join(" · ")}
      </p>
      {searchParams.erro === "partes" && <p role="alert" className="mt-3 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3 text-loss">{t.erroPartes}</p>}
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <div><dt className="text-sm text-stone">{t.vendedor}</dt><dd className="font-semibold">{nome(parte("vendedor")) ?? org.organizacao.nome}</dd></div>
        <div><dt className="text-sm text-stone">{t.comprador}</dt><dd className="font-semibold">{nome(parte("comprador")) ?? org.organizacao.nome}</dd></div>
        <div><dt className="text-sm text-stone">{t.financialPartner}</dt><dd className="font-semibold">{nome(parte("financial_partner")) ?? "—"}</dd></div>
      </dl>

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
        <h2>{d.instrumentos.titulo}</h2>
        <p className="mb-4 text-stone">{d.instrumentos.subtitulo}</p>
        <Instrumentos organizacaoId={orgId} contratoId={contrato.id} moeda={contrato.moeda}
                      instrumentos={instrumentos} monetizacoes={monetizacoes}
                      alertas={alertasInstrumentos(instrumentos, hojeISO())} clientes={clientes} projetos={projetosDaEmpresa}
                      fpContrato={parte("financial_partner")} vendedorContrato={parte("vendedor")} projetoContrato={contrato.projeto_id} />
      </section>

      <section className="secao max-w-4xl">
        <h2>{t.editar}</h2>
        <ProjetosForaDaEmpresa organizacaoId={orgId}
                               projetos={projetos.filter((p) => !p.organizacao_id && p.owner_id === usuario?.id)} />
        <FormContrato acao={atualizarContrato} organizacaoId={orgId} clientes={clientes} commodities={commodities}
                      projetos={projetosDaEmpresa}
                      valores={{ ...contrato, comprador_id: parte("comprador"), vendedor_id: parte("vendedor"),
                                 financial_partner_id: parte("financial_partner") }}
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
