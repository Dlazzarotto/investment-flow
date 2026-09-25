"use client";
import { useState, useTransition } from "react";
import { criarCommodity, criarGrade, criarLocal } from "@/app/actions/cadastros";
import { useI18n } from "@/lib/i18n/client";
import { especificacaoDoGrade, rotuloGrupo } from "@/lib/catalogo";
import { formatadores } from "@/lib/format";
import {
  TIPOS_LOCAL,
  type Commodity, type CommodityGrade, type CommodityGrupo, type CommodityParametro, type Local, type TipoLocal,
} from "@/lib/types";

/**
 * Criação rápida dentro do contrato. Não pode ser um <form> (form dentro de form
 * é HTML inválido e o navegador descarta o de dentro), então chama a server
 * action direto, com um FormData montado aqui, e devolve o id do que nasceu.
 */
function useCriarRapido() {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const criar = (acao: (s: { ok: boolean }, fd: FormData) => Promise<{ ok: boolean; erro?: string; id?: string }>,
                 campos: Record<string, string>, aoCriar: (id: string) => void) => {
    setErro(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    iniciar(async () => {
      const r = await acao({ ok: false }, fd);
      if (r.ok && r.id) aoCriar(r.id); else setErro(r.erro ?? null);
    });
  };
  return { pendente, erro, criar };
}

function CriarRapido({ rotuloBotao, rotuloCampo, id, pendente, erro, aoCriar, children }: {
  rotuloBotao: string; rotuloCampo: string; id: string; pendente: boolean; erro: string | null;
  aoCriar: (nome: string) => void; children?: React.ReactNode;
}) {
  const { d } = useI18n();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  if (!aberto) {
    return <button type="button" className="btn-quieto mt-2 px-3" onClick={() => setAberto(true)}>{rotuloBotao}</button>;
  }
  const enviar = () => { if (nome.trim()) aoCriar(nome.trim()); };
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-navy bg-navy-soft/40 p-3">
      <label className="rotulo" htmlFor={id}>{rotuloCampo}</label>
      <input id={id} className="campo" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enviar(); } }} />
      {children}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-navy" disabled={pendente || !nome.trim()} aria-busy={pendente} onClick={enviar}>
          {d.contratos.criarAgora}
        </button>
        <button type="button" className="btn-quieto" onClick={() => { setAberto(false); setNome(""); }}>{d.comum.cancelar}</button>
      </div>
      {erro && <p role="alert" className="text-loss">{erro}</p>}
    </div>
  );
}

/**
 * Grupo → Commodity → Grade, em cascata (0029). O grupo só filtra (não é gravado
 * no contrato: vem da commodity). Commodity e grade novos nascem aqui mesmo e já
 * ficam selecionados. Embaixo, a especificação que vale para o grade escolhido.
 */
export function SeletorProduto({ organizacaoId, grupos, commodities, grades, parametros, commodityInicial, gradeInicial }: {
  organizacaoId: string; grupos: CommodityGrupo[]; commodities: Commodity[]; grades: CommodityGrade[];
  parametros: CommodityParametro[]; commodityInicial: string | null | undefined; gradeInicial: string | null | undefined;
}) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.contratos;
  const [novasCommodities, setNovasCommodities] = useState<Commodity[]>([]);
  const [novosGrades, setNovosGrades] = useState<CommodityGrade[]>([]);
  const todas = [...commodities, ...novasCommodities];
  const todosGrades = [...grades, ...novosGrades];
  const inicial = todas.find((c) => c.id === commodityInicial);
  const [grupo, setGrupo] = useState<string>(inicial ? inicial.grupo_id ?? "" : "");
  const [commodity, setCommodity] = useState<string>(commodityInicial ?? "");
  const [grade, setGrade] = useState<string>(gradeInicial ?? "");
  const rc = useCriarRapido();
  const rg = useCriarRapido();

  // Todos os grupos (para poder criar a primeira commodity de um deles); os que já
  // têm commodity vêm primeiro, com a contagem.
  const qtd = (id: string) => todas.filter((c) => (c.grupo_id ?? "") === id).length;
  const ordenados = [...grupos].sort((a, b) => Number(qtd(b.id) > 0) - Number(qtd(a.id) > 0));
  const doGrupo = todas.filter((c) => (c.grupo_id ?? "") === grupo && (c.ativo || c.id === commodity));
  const gradesDela = todosGrades.filter((g) => g.commodity_id === commodity && (g.ativo || g.id === grade));
  const spec = commodity ? especificacaoDoGrade(parametros, commodity, grade || null) : null;
  const n = (x: number | null) => (x === null ? null : f.numero(Number(x), 2));

  return (
    <>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="grupo_sel">{t.grupo}</label>
        <select id="grupo_sel" className="campo" value={grupo}
                onChange={(e) => { setGrupo(e.target.value); setCommodity(""); setGrade(""); }}>
          <option value="">{d.cadastros.semGrupo} ({qtd("")})</option>
          {ordenados.map((g) => <option key={g.id} value={g.id}>{rotuloGrupo(g, d)} ({qtd(g.id)})</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="commodity_id">{t.commodity}</label>
        <select id="commodity_id" name="commodity_id" required className="campo" value={commodity}
                onChange={(e) => { setCommodity(e.target.value); setGrade(""); }}>
          <option value="" disabled>{t.escolha}</option>
          {doGrupo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <CriarRapido id="nova_commodity" rotuloBotao={t.novaCommodityRapida} rotuloCampo={t.nomeNovaCommodity}
                     pendente={rc.pendente} erro={rc.erro}
                     aoCriar={(nome) => rc.criar(criarCommodity,
                       { organizacao_id: organizacaoId, nome, grupo_id: grupo, unidade_padrao: "Toneladas", ativo: "on" },
                       (id) => {
                         setNovasCommodities((l) => [...l, {
                           id, organizacao_id: organizacaoId, grupo_id: grupo || null, nome, categoria: null,
                           unidade_padrao: "Toneladas", bolsa: null, observacoes: null, ativo: true, criado_em: "", atualizado_em: "",
                         }]);
                         setCommodity(id); setGrade("");
                       })} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="grade_id">{t.grade}</label>
        <select id="grade_id" name="grade_id" className="campo" value={grade} disabled={!commodity}
                onChange={(e) => setGrade(e.target.value)}>
          <option value="">{commodity ? t.semGrade : t.escolha}</option>
          {gradesDela.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        {commodity && (
          <CriarRapido id="novo_grade" rotuloBotao={t.novoGradeRapido} rotuloCampo={t.nomeNovoGrade}
                       pendente={rg.pendente} erro={rg.erro}
                       aoCriar={(nome) => rg.criar(criarGrade, { organizacao_id: organizacaoId, commodity_id: commodity, nome },
                         (id) => {
                           setNovosGrades((l) => [...l, {
                             id, organizacao_id: organizacaoId, commodity_id: commodity, nome, observacoes: null, ativo: true, criado_em: "",
                           }]);
                           setGrade(id);
                         })} />
        )}
      </div>
      {spec && (
        <div className="rounded-md border border-stone-light bg-stone-paper p-3 sm:col-span-6">
          <p className="font-semibold text-navy">{t.specDoGrade}</p>
          {spec.itens.length === 0 ? <p className="text-stone">{t.specVazia}</p> : (
            <>
              {spec.herdada && <p className="text-sm text-stone">{d.cadastros.herdaPadrao}</p>}
              <ul className="mt-1 flex flex-wrap gap-2">
                {spec.itens.map((p) => (
                  <li key={p.id} className="rounded bg-white px-2 py-1">
                    <span className="font-semibold">{p.nome}</span>{" "}
                    <span className="num">{[n(p.referencia) && `${n(p.referencia)} ${p.unidade}`,
                      n(p.minimo) && `≥ ${n(p.minimo)}`, n(p.maximo) && `≤ ${n(p.maximo)}`].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Um seletor de local com "+ novo local". Os locais novos sobem para o
 * formulário (`aoCriar`) para aparecerem em TODOS os seletores — o porto criado
 * como carga pode ser o transbordo de outro contrato.
 */
export function SeletorLocal({ name, rotulo, locais, valor, aoMudar, organizacaoId, aoCriar, tipoPadrao = "porto", vazio }: {
  name: string; rotulo: string; locais: Local[]; valor: string; aoMudar: (id: string) => void;
  organizacaoId: string; aoCriar: (l: Local) => void; tipoPadrao?: TipoLocal; vazio: string;
}) {
  const { d } = useI18n();
  const t = d.contratos;
  const r = useCriarRapido();
  const [tipo, setTipo] = useState<TipoLocal>(tipoPadrao);
  const visiveis = locais.filter((l) => l.ativo || l.id === valor);
  return (
    <div className="sm:col-span-3">
      <label className="rotulo" htmlFor={name}>{rotulo}</label>
      <select id={name} name={name} className="campo" value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">{vazio}</option>
        {visiveis.map((l) => (
          <option key={l.id} value={l.id}>{[l.nome, l.pais].filter(Boolean).join(" — ")} ({d.enums.tipoLocal[l.tipo]})</option>
        ))}
      </select>
      <CriarRapido id={`novo_${name}`} rotuloBotao={t.novoLocalRapido} rotuloCampo={t.nomeNovoLocal}
                   pendente={r.pendente} erro={r.erro}
                   aoCriar={(nome) => r.criar(criarLocal, { organizacao_id: organizacaoId, nome, tipo, ativo: "on" }, (id) => {
                     aoCriar({ id, organizacao_id: organizacaoId, nome, tipo, pais: null, regiao: null, unlocode: null,
                               calado_max_m: null, observacoes: null, ativo: true, criado_em: "" });
                     aoMudar(id);
                   })}>
        <label className="rotulo" htmlFor={`tipo_${name}`}>{d.cadastros.tipoLocal}</label>
        <select id={`tipo_${name}`} className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoLocal)}>
          {TIPOS_LOCAL.map((x) => <option key={x} value={x}>{d.enums.tipoLocal[x]}</option>)}
        </select>
      </CriarRapido>
    </div>
  );
}
