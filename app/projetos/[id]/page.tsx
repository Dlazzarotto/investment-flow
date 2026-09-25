import Link from "next/link";
import { excluirProjeto, mudarStatusProjeto } from "@/app/actions/projetos";
import { ConfirmarExclusaoProjeto } from "@/components/ConfirmarExclusaoProjeto";
import { SelectAutoSubmit } from "@/components/ui/SelectAutoSubmit";
import { SeloStatus } from "@/components/contratos/SeloStatus";
import {
  capitalPorProjeto, listarContratos, listarParticipantes, listarRemuneracoes, obterPapel, obterProjeto, obterResumo,
} from "@/lib/consultas";
import { baseDoProjeto, projetarRemuneracao, valorContrato } from "@/lib/contratos";
import { permissoes } from "@/lib/permissoes";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { STATUS_PROJETO } from "@/lib/types";
import { FormAcao } from "@/components/ui/FormAcao";

export const dynamic = "force-dynamic";

/**
 * Resumo do projeto — o que a empresa ADMINISTRA para investidores (0022).
 * Resultado (o mesmo que o investidor vê, via resumo_projeto), sócios, como a
 * empresa ganha, e os contratos feitos por conta do projeto. Vender e comprar
 * são da empresa (menu principal); aqui só se enxerga o que é do projeto.
 */
export default async function ResumoProjetoPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.resumoProjeto;
  const projeto = await obterProjeto(params.id);
  const papel = await obterPapel(projeto.id);
  const pode = permissoes(papel);
  const org = projeto.organizacao_id;
  const [resumo, participantes, contratos, remuneracoes, capital] = await Promise.all([
    obterResumo(projeto.id), listarParticipantes(projeto.id),
    org && pode.administrar ? listarContratos(org) : Promise.resolve([]),
    org && pode.administrar ? listarRemuneracoes(org) : Promise.resolve([]),
    capitalPorProjeto([projeto.id]),
  ]);
  const m = projeto.moeda;
  const doProjeto = contratos.filter((c) => c.projeto_id === projeto.id && c.conta === "projeto");
  const base = baseDoProjeto(contratos, projeto.id, capital.get(projeto.id) ?? 0, projeto.moeda);
  const ganhos = remuneracoes.filter((r) => r.projeto_id === projeto.id).map((r) => ({ r, p: projetarRemuneracao(r, base) }));
  const alocado = participantes.reduce((s, p) => s + Number(p.percentual), 0) + Number(projeto.participacao_pct);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{projeto.nome}</h1>
          <p className="mt-1 text-stone">
            {[d.enums.statusProjeto[projeto.status], m, fmtTexto(t.desde, { data: f.data(projeto.data_inicio) })].join(" · ")}
          </p>
        </div>
        {pode.administrar && (
          <FormAcao action={mudarStatusProjeto}>
            <input type="hidden" name="id" value={projeto.id} />
            <SelectAutoSubmit name="status" defaultValue={projeto.status} className="campo w-auto" ariaLabel={t.status}>
              {STATUS_PROJETO.map((s) => <option key={s} value={s}>{d.enums.statusProjeto[s]}</option>)}
            </SelectAutoSubmit>
          </FormAcao>
        )}
      </div>
      {projeto.descricao && <p className="mt-3">{projeto.descricao}</p>}

      <section className="secao">
        <h2>{t.resultado}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cartao rotulo={t.receita} valor={f.moeda(Number(resumo.receita_total), m)} />
          <Cartao rotulo={t.saida} valor={f.moeda(Number(resumo.saida_total), m)} nota={t.saidaNota} />
          <Cartao rotulo={t.saldo} valor={f.moeda(Number(resumo.saldo), m)} destaque
                  cor={Number(resumo.saldo) < 0 ? "text-loss" : "text-gain"} />
          <Cartao rotulo={t.aportes} valor={f.moeda(Number(resumo.aportes_total), m)} />
        </div>
        <p className="mt-2 text-sm text-stone">{t.resultadoNota}</p>
      </section>

      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.socios}</h2>
          <Link href={`/projetos/${projeto.id}/participantes`} className="text-navy underline">{t.gerirSocios}</Link>
        </div>
        {participantes.length === 0 ? <p className="text-stone">{t.semSocios}</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {participantes.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-stone-light bg-white px-4 py-3">
                <span className="font-medium">{p.nome} <span className="text-stone">· {d.enums.tipoParticipante[p.tipo]}</span></span>
                <span className="num font-semibold text-navy">{f.numero(Number(p.percentual), 2)} %</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-stone">
          {fmtTexto(t.alocado, { pct: f.numero(alocado, 2) })}
          {Number(projeto.participacao_pct) > 0 && ` · ${fmtTexto(t.empresaSocia, { pct: f.numero(Number(projeto.participacao_pct), 2) })}`}
        </p>
      </section>

      {pode.administrar && (
        <section className="secao">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="mb-0">{t.ganhoEmpresa}</h2>
            <Link href={`/projetos/${projeto.id}/participantes#gestao`} className="text-navy underline">{t.definirGanho}</Link>
          </div>
          {ganhos.length === 0 ? <p className="rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{t.semGanho}</p> : (
            <ul className="grid gap-2">
              {ganhos.map(({ r, p }) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-light bg-white px-4 py-3">
                  <span className="font-medium">{d.enums.tipoRemuneracao[r.tipo]}</span>
                  <span className="num text-stone">
                    {p.porAno !== null ? `${f.moeda(p.porAno, m)} ${d.gestao.porAno}`
                      : p.sobContratos !== null ? `${f.moeda(p.sobContratos, m)} ${d.gestao.sobContratos}` : d.gestao.aConfirmar}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pode.administrar && (
        <section className="secao">
          <h2>{t.contratos}</h2>
          {doProjeto.length === 0 ? <p className="text-stone">{t.semContratos}</p> : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {doProjeto.map((c) => {
                const v = valorContrato(c);
                return (
                  <li key={c.id}>
                    <Link href={`/contratos/${c.id}`} className="block min-h-touch rounded-md border border-stone-light bg-white px-4 py-3 hover:border-navy">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-navy">{c.numero ?? d.contratos.semNumero} · {d.enums.direcaoContrato[c.direcao]}</span>
                        <SeloStatus status={c.status} rotulo={d.enums.statusContrato[c.status]} />
                      </div>
                      <p className="num mt-1 text-stone">
                        {f.numero(Number(c.volume), 0)} {rotuloUnidade(c.unidade, d)} · {v === null ? d.contratos.valorAConfirmar : f.moeda(v, c.moeda)}
                      </p>
                      {c.moeda !== projeto.moeda && (
                        <p className="mt-1 text-sm text-orange-deep">{fmtTexto(t.outraMoeda, { moeda: c.moeda, projeto: projeto.moeda })}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-sm text-stone">{t.contratosNota}</p>
        </section>
      )}

      {/* Aqui, junto do status: encerrar e excluir são decisões sobre o projeto inteiro. */}
      {pode.ehDono && (
        <section className="secao max-w-3xl border-t border-stone-light pt-8">
          <h2 className="text-loss">{d.parceria.excluirProjeto}</h2>
          <p className="mb-4 text-stone">{d.parceria.excluirTexto}</p>
          <ConfirmarExclusaoProjeto action={excluirProjeto} projetoId={projeto.id} nome={projeto.nome} />
        </section>
      )}
    </>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false, cor = "text-navy" }:
  { rotulo: string; valor: string; nota?: string; destaque?: boolean; cor?: string }) {
  return (
    <div className={`rounded-md border p-4 ${destaque ? "border-navy bg-navy-soft" : "border-stone-light bg-white"}`}>
      <p className="text-sm text-stone">{rotulo}</p>
      <p className={`num mt-1 text-lg font-semibold ${cor}`}>{valor}</p>
      {nota && <p className="mt-1 text-sm text-stone">{nota}</p>}
    </div>
  );
}
