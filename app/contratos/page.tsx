import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Vazio } from "@/components/ui/Vazio";
import { SeloStatus } from "@/components/contratos/SeloStatus";
import {
  ehMaster, listarCarteira, listarClientes, listarCommodities, listarContratos, listarPartes, listarProjetos,
  minhaOrganizacao,
} from "@/lib/consultas";
import { valorContrato, comissaoAgente } from "@/lib/contratos";
import { obterD } from "@/lib/i18n/server";
import { rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { DIRECOES_CONTRATO, STATUS_CONTRATO, type DirecaoContrato, type StatusContrato } from "@/lib/types";

export const dynamic = "force-dynamic";
/** Contratos da empresa: o centro da operação (proposta → contrato → embarques). */
export default async function ContratosPage({ searchParams }: { searchParams: { status?: string; direcao?: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.contratos;
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  // Contrato é da administração da empresa; quem não tem empresa segue o caminho de sempre.
  if (!org) redirect("/projetos");
  const orgId = org.organizacao.id;
  const [contratos, clientes, commodities, partes] = await Promise.all([
    listarContratos(orgId), listarClientes(orgId), listarCommodities(orgId), listarPartes(orgId),
  ]);
  // "Comprador → vendedor"; a empresa aparece pelo nome quando é ela uma das pontas.
  const ponta = (contratoId: string, papel: "comprador" | "vendedor") => {
    const p = partes.find((x) => x.contrato_id === contratoId && x.papel === papel);
    return p ? nomeCliente.get(p.cliente_id) : org.organizacao.nome;
  };
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeCommodity = new Map(commodities.map((c) => [c.id, c.nome]));

  const status = (STATUS_CONTRATO as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as StatusContrato) : null;
  const direcao = (DIRECOES_CONTRATO as readonly string[]).includes(searchParams.direcao ?? "")
    ? (searchParams.direcao as DirecaoContrato) : null;
  const lista = contratos.filter((c) => (!status || c.status === status) && (!direcao || c.direcao === direcao));
  const filtro = (s: StatusContrato | null, dir: DirecaoContrato | null) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (dir) q.set("direcao", dir);
    const qs = q.toString();
    return qs ? `/contratos?${qs}` : "/contratos";
  };
  const faltaCadastro = clientes.length === 0 || commodities.length === 0;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org.organizacao.nome}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t.titulo}</h1>
          <p className="mt-1 text-stone">{t.subtitulo}</p>
        </div>
        {!faltaCadastro && <Link href="/contratos/novo" className="btn-primario">+ {t.novo}</Link>}
      </div>

      {faltaCadastro ? (
        <div className="mt-6">
          <Vazio titulo={t.faltaCadastroTitulo} texto={t.faltaCadastroTexto} />
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/clientes" className="btn-quieto">{d.nav.clientes}</Link>
            <Link href="/commodities" className="btn-quieto">{d.nav.commodities}</Link>
          </div>
        </div>
      ) : (
        <>
          <nav aria-label={t.filtros} className="mt-6 flex flex-wrap gap-2">
            <Link href={filtro(null, direcao)} className={`btn-quieto px-3 ${!status ? "border-navy bg-navy-soft" : ""}`}>{t.todos}</Link>
            {STATUS_CONTRATO.map((s) => (
              <Link key={s} href={filtro(s, direcao)} className={`btn-quieto px-3 ${status === s ? "border-navy bg-navy-soft" : ""}`}>
                {d.enums.statusContrato[s]}
              </Link>
            ))}
          </nav>
          <nav aria-label={t.direcao} className="mt-2 flex flex-wrap gap-2">
            <Link href={filtro(status, null)} className={`btn-quieto px-3 ${!direcao ? "border-navy bg-navy-soft" : ""}`}>{t.vendaECompra}</Link>
            {DIRECOES_CONTRATO.map((x) => (
              <Link key={x} href={filtro(status, x)} className={`btn-quieto px-3 ${direcao === x ? "border-navy bg-navy-soft" : ""}`}>
                {d.enums.direcaoContrato[x]}
              </Link>
            ))}
          </nav>

          <div className="mt-6">
            {lista.length === 0 ? (
              <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} />
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {lista.map((c) => {
                  const valor = c.papel === "agente" ? comissaoAgente(c) : valorContrato(c);
                  return (
                    <li key={c.id}>
                      <Link href={`/contratos/${c.id}`}
                            className="block min-h-touch rounded-md border border-stone-light bg-white px-5 py-4 hover:border-navy">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-lg font-semibold text-navy">
                            {c.numero ?? t.semNumero}
                          </p>
                          <SeloStatus status={c.status} rotulo={d.enums.statusContrato[c.status]} />
                        </div>
                        <p className="mt-1 font-medium">{ponta(c.id, "vendedor")} → {ponta(c.id, "comprador")}</p>
                        <p className="mt-1 text-stone">
                          {[c.conta === "projeto" ? d.enums.contaContrato.projeto : null,
                            c.papel === "agente" ? null : d.enums.direcaoContrato[c.direcao], d.enums.papelContrato[c.papel],
                            d.enums.modalidadeContrato[c.modalidade], nomeCommodity.get(c.commodity_id), c.incoterm].filter(Boolean).join(" · ")}
                        </p>
                        <p className="num mt-1">
                          {f.numero(Number(c.volume), 0)} {rotuloUnidade(c.unidade, d)}
                          {" · "}
                          {valor === null ? t.valorAConfirmar
                            : `${c.papel === "agente" ? `${t.comissao} ` : ""}${f.moeda(valor, c.moeda)}`}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
