"use client";
import { useState, useTransition } from "react";
import {
  adotarCommodity, atualizarCommodity, criarCommodity, criarGrade, criarGrupo, criarParametro, excluirCommodity, excluirGrade, excluirGrupo,
  excluirParametro,
} from "@/app/actions/cadastros";
import { Cadastro } from "./Cadastro";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { especificacaoDoGrade, rotuloGrupo } from "@/lib/catalogo";
import type { Commodity, CommodityGrade, CommodityGrupo, CommodityPadrao, CommodityParametro } from "@/lib/types";
import { FormAcao } from "@/components/ui/FormAcao";

interface Props {
  grupos: CommodityGrupo[];
  catalogo: CommodityPadrao[];
  commodities: Commodity[];
  grades: CommodityGrade[];
  parametros: CommodityParametro[];
  organizacaoId: string;
}

const SEM_GRUPO = "__sem_grupo__";

/**
 * O catálogo em árvore (0029): Grupo → Commodity → Grade → Especificação.
 * Escolher o grupo abre as commodities dele; cada commodity abre os grades, e
 * cada grade a sua especificação (ou herda a padrão da commodity).
 */
export function ListaCommodities({ grupos, catalogo, commodities, grades, parametros, organizacaoId }: Props) {
  const { d } = useI18n();
  const t = d.cadastros;
  const daEmpresa = (id: string) => commodities.filter((c) => (c.grupo_id ?? SEM_GRUPO) === id).length;
  // O número do botão é o que há para escolher: as da empresa + as do mercado ainda não adicionadas.
  // Contar só as da empresa mostrava "(0)" em grupo cheio de opções.
  const adotadas = new Set(commodities.map((c) => c.padrao_codigo).filter(Boolean));
  const contagem = (id: string) => {
    const g = grupos.find((x) => x.id === id);
    return daEmpresa(id) + (g?.codigo ? catalogo.filter((p) => p.grupo_codigo === g.codigo && !adotadas.has(p.codigo)).length : 0);
  };
  const temSemGrupo = daEmpresa(SEM_GRUPO) > 0;
  // Abre no primeiro grupo que tem commodity; empresa nova abre no primeiro da lista.
  const inicial = grupos.find((g) => daEmpresa(g.id) > 0)?.id ?? (temSemGrupo ? SEM_GRUPO : grupos[0]?.id ?? SEM_GRUPO);
  const [grupo, setGrupo] = useState(inicial);
  const [novoGrupo, setNovoGrupo] = useState(false);

  const atual = grupos.find((g) => g.id === grupo);
  const itens = commodities.filter((c) => (c.grupo_id ?? SEM_GRUPO) === grupo);

  return (
    <>
      <nav aria-label={t.grupos}>
        {/* No celular, 12 botões ocupariam uma tela inteira antes das commodities: vira um seletor. */}
        <div className="sm:hidden">
          <label className="rotulo" htmlFor="grupo-celular">{t.grupos}</label>
          <select id="grupo-celular" className="campo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            {grupos.map((g) => <option key={g.id} value={g.id}>{rotuloGrupo(g, d)} ({contagem(g.id)})</option>)}
            {temSemGrupo && <option value={SEM_GRUPO}>{t.semGrupo} ({contagem(SEM_GRUPO)})</option>}
          </select>
        </div>
        <p className="rotulo hidden sm:block">{t.grupos}</p>
        <ul className="hidden flex-wrap gap-2 sm:flex">
          {grupos.map((g) => (
            <li key={g.id}>
              <Chip ativo={grupo === g.id} onClick={() => setGrupo(g.id)} rotulo={rotuloGrupo(g, d)} n={contagem(g.id)} />
            </li>
          ))}
          {temSemGrupo && (
            <li><Chip ativo={grupo === SEM_GRUPO} onClick={() => setGrupo(SEM_GRUPO)} rotulo={t.semGrupo} n={contagem(SEM_GRUPO)} /></li>
          )}
          <li>
            <button type="button" className="btn-quieto min-h-touch px-3" aria-expanded={novoGrupo}
                    onClick={() => setNovoGrupo(!novoGrupo)}>+ {t.novoGrupo}</button>
          </li>
        </ul>
        <button type="button" className="btn-quieto mt-2 min-h-touch px-3 sm:hidden" aria-expanded={novoGrupo}
                onClick={() => setNovoGrupo(!novoGrupo)}>+ {t.novoGrupo}</button>
        {novoGrupo && <FormGrupo organizacaoId={organizacaoId} aoCriar={(id) => { setNovoGrupo(false); if (id) setGrupo(id); }} />}
      </nav>

      <section className="mt-6" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="mb-0">{atual ? rotuloGrupo(atual, d) : t.semGrupo}</h2>
          {atual && (atual.organizacao_id === null ? (
            <span className="rounded bg-navy-soft px-2 py-0.5 text-sm text-navy">{t.grupoPadrao}</span>
          ) : (
            <FormAcao action={excluirGrupo}
                  onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirGrupo, { nome: rotuloGrupo(atual, d) }))) e.preventDefault(); }}>
              <input type="hidden" name="id" value={atual.id} />
              <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
            </FormAcao>
          ))}
        </div>

        {atual?.codigo && (
          <CatalogoMercado organizacaoId={organizacaoId}
                           itens={catalogo.filter((p) => p.grupo_codigo === atual.codigo)}
                           adotados={new Set(commodities.map((c) => c.padrao_codigo).filter((x): x is NonNullable<typeof x> => !!x))} />
        )}

        <h3 className="mb-2 mt-6 text-lg text-navy">{t.daEmpresa}</h3>
        <Cadastro<Commodity>
          key={grupo}
          itens={itens} organizacaoId={organizacaoId}
          criar={criarCommodity} atualizar={atualizarCommodity} excluir={excluirCommodity}
          rotuloNovo={t.novaCommodity} vazioTitulo={t.semCommodities} vazioTexto={atual?.codigo ? t.semCommoditiesGrupo : t.semCommoditiesTexto}
          chave={(c) => c.id} nome={(c) => c.nome}
          confirmacao={(c) => fmtTexto(t.excluirCommodity, { nome: c.nome })}
          resumo={(c) => (
            <>
              <p className="font-semibold text-navy">
                {c.nome}
                {!c.ativo && <span className="ml-2 rounded bg-stone-light px-2 py-0.5 text-sm text-stone">{t.inativo}</span>}
              </p>
              <p className="mt-1 text-stone">{[rotuloUnidade(c.unidade_padrao, d), c.bolsa].filter(Boolean).join(" · ")}</p>
              {!c.grupo_id && c.categoria && <p className="text-sm text-stone">{fmtTexto(t.categoriaAntiga, { x: c.categoria })}</p>}
              <Grades commodity={c} grades={grades.filter((g) => g.commodity_id === c.id)} parametros={parametros}
                      organizacaoId={organizacaoId} />
            </>
          )}
          campos={(c) => {
            const id = c?.id ?? "novo";
            return (
              <>
                <div className="sm:col-span-3">
                  <label className="rotulo" htmlFor={`cnome-${id}`}>{t.nome}</label>
                  <input id={`cnome-${id}`} name="nome" required maxLength={160} className="campo" defaultValue={c?.nome} />
                </div>
                <div className="sm:col-span-3">
                  <label className="rotulo" htmlFor={`cgrupo-${id}`}>{t.grupo}</label>
                  <select id={`cgrupo-${id}`} name="grupo_id" className="campo"
                          defaultValue={c ? c.grupo_id ?? "" : grupo === SEM_GRUPO ? "" : grupo}>
                    <option value="">{t.semGrupo}</option>
                    {grupos.map((g) => <option key={g.id} value={g.id}>{rotuloGrupo(g, d)}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="rotulo" htmlFor={`cuni-${id}`}>{t.unidadePadrao}</label>
                  <input id={`cuni-${id}`} name="unidade_padrao" required maxLength={40} className="campo"
                         defaultValue={c?.unidade_padrao ?? "Toneladas"} />
                </div>
                <div className="sm:col-span-4">
                  <label className="rotulo" htmlFor={`cbol-${id}`}>{t.bolsa}</label>
                  <input id={`cbol-${id}`} name="bolsa" maxLength={160} className="campo"
                         placeholder={t.bolsaPlaceholder} defaultValue={c?.bolsa ?? ""} />
                </div>
                <div className="sm:col-span-6">
                  <label className="rotulo" htmlFor={`cobs-${id}`}>{t.observacoes}</label>
                  <input id={`cobs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={c?.observacoes ?? ""} />
                </div>
                <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
                  <input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} className="h-6 w-6 accent-navy" />
                  <span>{t.ativo}</span>
                </label>
              </>
            );
          }}
        />
      </section>
    </>
  );
}

/**
 * As commodities do mercado deste grupo (0030). Um toque adota: nasce a commodity
 * da empresa com nome, grupo, unidade e referência de preço — sem digitar nada.
 */
function CatalogoMercado({ organizacaoId, itens, adotados }:
  { organizacaoId: string; itens: CommodityPadrao[]; adotados: Set<string> }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<string[]>([]);
  const livres = itens.filter((p) => !adotados.has(p.codigo) && !feitos.includes(p.codigo));
  const adotar = (codigo: string) => {
    setErro(null);
    const fd = new FormData();
    fd.set("organizacao_id", organizacaoId); fd.set("codigo", codigo);
    iniciar(async () => {
      const r = await adotarCommodity({ ok: false }, fd);
      if (r.ok) setFeitos((l) => [...l, codigo]); else setErro(r.erro ?? null);
    });
  };
  return (
    <div className="rounded-md border border-stone-light bg-white p-4">
      <p className="font-semibold text-navy">{t.catalogoMercado}</p>
      {livres.length === 0 ? <p className="mt-1 text-stone">{t.tudoAdotado}</p> : (
        <>
          <p className="mt-1 text-sm text-stone">{t.catalogoMercadoAjuda}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {livres.map((p) => (
              <li key={p.codigo}>
                <button type="button" disabled={pendente} aria-busy={pendente} onClick={() => adotar(p.codigo)}
                        className="flex min-h-touch w-full items-center justify-between gap-3 rounded-md border border-stone-light px-3 py-2 text-left hover:border-navy hover:bg-navy-soft">
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{d.enums.commodityPadrao[p.codigo]}</span>
                    {p.referencia && p.referencia !== "—" && <span className="block text-sm text-stone">{p.referencia}</span>}
                  </span>
                  <span aria-hidden className="text-2xl font-semibold text-orange">+</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {erro && <p role="alert" className="mt-2 text-loss">{erro}</p>}
      <p className="mt-3 text-sm text-stone">{t.naoEncontrou}</p>
    </div>
  );
}

function Chip({ ativo, onClick, rotulo, n }: { ativo: boolean; onClick: () => void; rotulo: string; n: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
            className={`min-h-touch rounded-md border px-3 text-left ${ativo ? "border-navy bg-navy text-white" : "border-stone-light bg-white text-navy hover:border-navy"}`}>
      {rotulo} <span className={`num ${ativo ? "text-white/80" : "text-stone"}`}>({n})</span>
    </button>
  );
}

function FormGrupo({ organizacaoId, aoCriar }: { organizacaoId: string; aoCriar: (id?: string) => void }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [estado, formAction] = useAcaoFormulario(async (s, fd) => {
    const r = await criarGrupo(s, fd);
    if (r.ok) aoCriar(r.id);
    return r;
  });
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <div className="min-w-[14rem] flex-1">
        <label className="rotulo" htmlFor="novo-grupo">{t.nomeGrupo}</label>
        <input id="novo-grupo" name="nome" required maxLength={80} className="campo" autoFocus />
      </div>
      <SubmitButton className="btn-quieto">{d.comum.salvar}</SubmitButton>
      <div className="w-full"><Mensagem estado={estado} /></div>
    </form>
  );
}

/** Grades da commodity, cada um com a sua especificação; no topo, a padrão que eles herdam. */
function Grades({ commodity: c, grades, parametros, organizacaoId }:
  { commodity: Commodity; grades: CommodityGrade[]; parametros: CommodityParametro[]; organizacaoId: string }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [aberto, setAberto] = useState(false);
  const padrao = parametros.filter((p) => p.commodity_id === c.id && p.grade_id === null);

  return (
    <div className="mt-3">
      <button type="button" className="btn-quieto px-3 text-sm" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {t.grades} ({grades.length}) · {t.especificacao}
      </button>
      {aberto && (
        <div className="mt-3 grid grid-cols-1 gap-4 rounded-md border border-stone-light bg-stone-paper p-3">
          <div>
            <p className="font-semibold text-navy">{t.especificacaoPadrao}</p>
            <p className="text-sm text-stone">{t.especificacaoPadraoAjuda}</p>
            <TabelaSpec itens={padrao} />
            <FormParametro commodityId={c.id} gradeId={null} />
          </div>
          <div>
            <p className="font-semibold text-navy">{t.grades}</p>
            {grades.length === 0 && <p className="text-stone">{t.semGrades}</p>}
            <ul className="mt-2 grid grid-cols-1 gap-2">
              {grades.map((g) => <LinhaGrade key={g.id} grade={g} parametros={parametros} />)}
            </ul>
            <FormGrade commodityId={c.id} organizacaoId={organizacaoId} />
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaGrade({ grade: g, parametros }: { grade: CommodityGrade; parametros: CommodityParametro[] }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [aberto, setAberto] = useState(false);
  const spec = especificacaoDoGrade(parametros, g.commodity_id, g.id);
  const proprios = spec.herdada ? 0 : spec.itens.length;
  return (
    <li className="rounded-md border border-stone-light bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-navy">{g.nome}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-quieto px-3" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
            {t.especificacao} ({proprios})
          </button>
          <FormAcao action={excluirGrade}
                onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirGrade, { nome: g.nome }))) e.preventDefault(); }}>
            <input type="hidden" name="id" value={g.id} />
            <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
          </FormAcao>
        </div>
      </div>
      {aberto && (
        <div className="mt-3">
          {spec.herdada && <p className="text-sm text-stone">{t.herdaPadrao}</p>}
          <TabelaSpec itens={spec.herdada ? [] : spec.itens} />
          <FormParametro commodityId={g.commodity_id} gradeId={g.id} />
        </div>
      )}
    </li>
  );
}

function FormGrade({ commodityId, organizacaoId }: { commodityId: string; organizacaoId: string }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [estado, formAction] = useAcaoFormulario(criarGrade);
  return (
    <form key={estado.versao} action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <input type="hidden" name="commodity_id" value={commodityId} />
      <div className="min-w-[14rem] flex-1">
        <label className="rotulo" htmlFor={`grade-${commodityId}`}>{t.gradeNome}</label>
        <input id={`grade-${commodityId}`} name="nome" required maxLength={120} className="campo"
               placeholder={t.gradeNomePlaceholder} />
      </div>
      <SubmitButton className="btn-quieto">{t.novoGrade}</SubmitButton>
      <div className="w-full"><Mensagem estado={estado} /></div>
    </form>
  );
}

function TabelaSpec({ itens }: { itens: CommodityParametro[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.cadastros;
  if (itens.length === 0) return <p className="mt-2 text-stone">{t.semParametros}</p>;
  const n = (x: number | null) => (x === null ? "—" : f.numero(Number(x), 2));
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th>{t.parametroNome}</th><th className="num">{t.referencia}</th>
            <th className="num">{t.minimo}</th><th className="num">{t.maximo}</th>
            <th className="num">{t.ajustePorPonto}</th><th>{d.comum.acoes}</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.nome} <span className="text-stone">({p.unidade})</span></td>
              <td className="num">{n(p.referencia)}</td>
              <td className="num">{n(p.minimo)}</td>
              <td className="num">{n(p.maximo)}</td>
              <td className={`num font-semibold ${Number(p.ajuste_por_ponto) < 0 ? "text-loss" : "text-navy"}`}>
                {f.numero(Number(p.ajuste_por_ponto), 2)}
              </td>
              <td>
                <FormAcao action={excluirParametro}
                      onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirParametro, { nome: p.nome }))) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                </FormAcao>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormParametro({ commodityId, gradeId }: { commodityId: string; gradeId: string | null }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [estado, formAction] = useAcaoFormulario(criarParametro);
  const id = `${commodityId}-${gradeId ?? "padrao"}`;
  return (
    <form key={estado.versao} action={formAction} className="mt-3 grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="commodity_id" value={commodityId} />
      <input type="hidden" name="grade_id" value={gradeId ?? ""} />
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`pnome-${id}`}>{t.parametroNome}</label>
        <input id={`pnome-${id}`} name="nome" required maxLength={80} className="campo" placeholder={t.parametroNomePlaceholder} />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`puni-${id}`}>{d.comum.unidade}</label>
        <input id={`puni-${id}`} name="unidade" required maxLength={20} className="campo" defaultValue="%" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pref-${id}`}>{t.referencia}</label>
        <input id={`pref-${id}`} name="referencia" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pmin-${id}`}>{t.minimo}</label>
        <input id={`pmin-${id}`} name="minimo" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pmax-${id}`}>{t.maximo}</label>
        <input id={`pmax-${id}`} name="maximo" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`paj-${id}`}>{t.ajustePorPonto}</label>
        {/* Sem min: sílica e umidade derrubam o preço, então negativo é válido. */}
        <input id={`paj-${id}`} name="ajuste_por_ponto" type="number" inputMode="decimal" step="any"
               className="campo num" defaultValue={0} />
      </div>
      <div className="flex items-end sm:col-span-4">
        <SubmitButton className="btn-quieto">{t.novoParametro}</SubmitButton>
      </div>
      <p className="text-sm text-stone sm:col-span-6">{t.ajusteAjuda}</p>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
