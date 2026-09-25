import { Shell } from "@/components/Shell";
import Link from "next/link";
import { ListaCommodities } from "@/components/cadastros/ListaCommodities";
import { PesquisaMercado } from "@/components/pesquisa/PesquisaMercado";
import { pesquisaConfigurada } from "@/lib/ia/pesquisador";
import { Vazio } from "@/components/ui/Vazio";
import {
  ehMaster, listarCarteira, listarCommodities, listarCommoditiesPadrao, listarGrades, listarPesquisas, listarGrupos, listarParametros, listarProjetos, minhaOrganizacao,
} from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Catálogo do que a empresa negocia (0029): Grupo → Commodity → Grade → Especificação. */
export default async function CommoditiesPage({ searchParams }: { searchParams: { aba?: string } }) {
  const aba = searchParams.aba === "pesquisa" ? "pesquisa" : "catalogo";
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  const orgId = org?.organizacao.id;
  const [commodities, grupos, grades, catalogo, pesquisas] = await Promise.all([
    listarCommodities(orgId), listarGrupos(orgId), listarGrades(orgId), listarCommoditiesPadrao(), listarPesquisas(orgId),
  ]);
  const parametros = await listarParametros(commodities.map((c) => c.id));
  const t = d.cadastros;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{t.commoditiesTitulo}</h1>
      <p className="mt-1 text-stone">{t.commoditiesSubtitulo}</p>
      {org && (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label={t.commoditiesTitulo}>
          {(["catalogo", "pesquisa"] as const).map((x) => (
            <Link key={x} href={x === "catalogo" ? "/commodities" : "/commodities?aba=pesquisa"} aria-current={aba === x ? "page" : undefined}
                  className={`btn-quieto px-4 ${aba === x ? "border-navy bg-navy text-white hover:bg-navy" : ""}`}>
              {x === "catalogo" ? t.abaCatalogo : d.pesquisa.titulo}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-6">
        {!org ? (
          <Vazio titulo={t.semEmpresa} texto={t.semEmpresaTexto} />
        ) : aba === "pesquisa" ? (
          <>
            <p className="mb-4 text-stone">{d.pesquisa.subtitulo}</p>
            <PesquisaMercado commodities={commodities} catalogo={catalogo} grades={grades} pesquisas={pesquisas.filter((p) => p.modo !== "bolsas")} configurada={pesquisaConfigurada()} />
          </>
        ) : (
          <ListaCommodities grupos={grupos} catalogo={catalogo} commodities={commodities} grades={grades} parametros={parametros}
                            organizacaoId={org.organizacao.id} />
        )}
      </div>
    </Shell>
  );
}
