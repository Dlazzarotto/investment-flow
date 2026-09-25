import Link from "next/link";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { rotuloUnidade } from "@/lib/i18n";
import type { AlertaInstrumento, ReceitaEmpresa, ResumoContratos } from "@/lib/contratos";
import { type PainelEmpresa as Painel, type StatusProjeto } from "@/lib/types";

/**
 * O dashboard do ADM: a empresa inteira, não um projeto.
 *
 * As contagens vêm da primeira linha (empresa não tem moeda); o dinheiro sai
 * por moeda, e com uma moeda só — o caso normal — fica igual a um painel comum.
 */
export function PainelEmpresa({ painel, contratos, nomesCommodity, nomesProjeto, receita, alertas, projetosStatus }:
  { painel: Painel[]; contratos: ResumoContratos; nomesCommodity: Map<string, string>; nomesProjeto: Map<string, string>;
    projetosStatus: Record<StatusProjeto, number>;
    receita: ReceitaEmpresa[]; alertas: (AlertaInstrumento & { contrato_id: string; rotulo: string })[] }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.painel;
  const c = painel[0];

  return (
    <>
      {/* Prazo de LC perdido é pagamento perdido: o alerta vem antes de tudo. */}
      {alertas.length > 0 && (
        <section className="secao">
          <h2>{t.instrumentosAlerta}</h2>
          <ul className="grid gap-2">
            {alertas.map((a) => (
              <li key={`${a.instrumento_id}-${a.motivo}`}>
                <Link href={`/contratos/${a.contrato_id}`}
                      className="block min-h-touch rounded-md border-l-4 border-loss bg-red-50 px-4 py-3 font-semibold text-loss hover:underline">
                  {a.rotulo} · {a.dias < 0 ? fmtTexto(d.instrumentos.atrasado, { dias: -a.dias })
                    : fmtTexto(a.motivo === "apresentacao" ? d.instrumentos.alertaApresentacao : d.instrumentos.alertaValidade, { dias: a.dias })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* O que a EMPRESA ganha: intermediação, monetização e gestão — o que é dos projetos fica fora. */}
      {receita.length > 0 && (
        <section className="secao">
          <h2>{t.receitaEmpresa}</h2>
          {receita.map((r) => (
            <div key={r.moeda} className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Cartao rotulo={`${t.receitaIntermediacao} · ${r.moeda}`} valor={f.moeda(r.intermediacao, r.moeda)} bom />
              <Cartao rotulo={`${t.receitaMonetizacao} · ${r.moeda}`} valor={f.moeda(r.monetizacao, r.moeda)} bom />
              <Cartao rotulo={`${t.receitaGestaoAno} · ${r.moeda}`} valor={f.moeda(r.gestaoAno, r.moeda)} bom />
              <Cartao rotulo={`${t.receitaGestaoContratos} · ${r.moeda}`} valor={f.moeda(r.gestaoContratos, r.moeda)} bom />
            </div>
          ))}
          <p className="mt-2 text-sm text-stone">{t.receitaNota}</p>
        </section>
      )}

      {/* A OPERAÇÃO vem primeiro: contrato é o centro do trading; o resto é consequência dele. */}
      <section className="secao">
        <h2>{t.operacao}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {(["venda", "compra"] as const).map((dir) => {
            const base = dir === "venda" ? "/vendas" : "/compras";
            return [
              <Cartao key={`${dir}-a`} href={`${base}?status=ativos`} rotulo={dir === "venda" ? t.vendasAtivas : t.comprasAtivas}
                      valor={String(contratos.porDirecao[dir].ativos)} nota={t.contratosAtivosNota} destaque={dir === "venda"} />,
              <Cartao key={`${dir}-n`} href={`${base}?status=rascunho`} rotulo={dir === "venda" ? t.vendasNegociacao : t.comprasNegociacao}
                      valor={String(contratos.porDirecao[dir].negociacao)} />,
            ];
          })}
        </div>
        {contratos.valores.map((v) => (
          <div key={v.moeda} className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao rotulo={`${t.contratadoVenda} · ${v.moeda}`} valor={f.moeda(v.venda, v.moeda)} bom />
            <Cartao rotulo={`${t.contratadoCompra} · ${v.moeda}`} valor={f.moeda(v.compra, v.moeda)} />
            {v.semPreco > 0 && (
              <Cartao rotulo={t.semPreco} valor={String(v.semPreco)} nota={t.semPrecoNota} alerta />
            )}
          </div>
        ))}
        {contratos.volumes.length > 0 && (
          <div className="mt-4">
            {/* Cartão por commodity, não tabela: quatro colunas com números de
                milhões não cabiam num celular de 390 px e a posição sumia. */}
            <ul className="grid gap-3 lg:grid-cols-2">
              {contratos.volumes.map((v) => {
                const posicao = v.compra - v.venda;
                return (
                  <li key={`${v.commodity_id}|${v.unidade}`} className="rounded-md border border-stone-light bg-white p-4">
                    <p className="font-semibold text-navy">
                      {nomesCommodity.get(v.commodity_id) ?? "—"} <span className="font-normal text-stone">({rotuloUnidade(v.unidade, d)})</span>
                    </p>
                    <dl className="mt-2 grid grid-cols-3 gap-2">
                      <div><dt className="text-sm text-stone">{t.volumeVenda}</dt><dd className="num font-semibold">{f.numero(v.venda, 0)}</dd></div>
                      <div><dt className="text-sm text-stone">{t.volumeCompra}</dt><dd className="num font-semibold">{f.numero(v.compra, 0)}</dd></div>
                      <div><dt className="text-sm text-stone">{t.posicao}</dt>
                        <dd className={`num font-semibold ${posicao < 0 ? "text-loss" : "text-navy"}`}>{f.numero(posicao, 0)}</dd></div>
                    </dl>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-sm text-stone">{t.posicaoAjuda}</p>
          </div>
        )}
      </section>

      {/* PROJETOS: o que a empresa administra para investidores (0022). Só os
          resultados deles chegam aqui — e NÃO somam no resultado da empresa. */}
      <section className="secao">
        <h2>{t.projetos}</h2>
        {/* Uma coluna no celular: "Em andamento" não cabe num terço de 390 px. */}
        <div className="grid gap-3 sm:grid-cols-3">
          {(["em_andamento", "encerrado", "em_analise"] as const).map((s) => (
            <Cartao key={s} href={`/projetos?status=${s}`} rotulo={d.enums.statusProjeto[s]}
                    valor={String(projetosStatus[s] ?? 0)} destaque={s === "em_andamento"} />
          ))}
        </div>
        {contratos.sobGestao.length > 0 && (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {contratos.sobGestao.map((g) => (
              <li key={`${g.projeto_id}|${g.moeda}`} className="rounded-md border border-stone-light bg-white p-4">
                <p className="font-semibold text-navy">{nomesProjeto.get(g.projeto_id) ?? "—"}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <div><dt className="text-sm text-stone">{t.contratosAtivos}</dt><dd className="num font-semibold">{g.contratos}</dd></div>
                  <div className="col-span-2"><dt className="text-sm text-stone">{t.contratadoVenda}</dt>
                    <dd className="num font-semibold">{f.moeda(g.venda, g.moeda)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-stone">{t.sobGestaoNota}</p>
      </section>

      <section className="secao">
        <h2>{t.carteira}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Cartao href="/clientes" rotulo={d.nav.clientes} valor={String(c?.clientes ?? 0)}
                  nota={fmtTexto(t.ativos, { n: c?.clientes_ativos ?? 0 })} />
          <Cartao href="/fornecedores" rotulo={d.nav.fornecedores} valor={String(c?.fornecedores ?? 0)} />
          <Cartao href="/commodities" rotulo={d.nav.commodities} valor={String(c?.commodities ?? 0)} />
          <Cartao href="/projetos" rotulo={d.projetos.titulo} valor={String(c?.projetos ?? 0)} />
        </div>
      </section>

      {/* Sem "resultado consolidado" de projetos aqui (0022): projeto sob gestão
          tem resultado próprio, no bloco Projetos e na página dele — somar
          investimentos e vendas de projetos na empresa dava um saldo que não é dela. */}

    </>
  );
}

function Cartao({ rotulo, valor, nota, href, bom = false, alerta = false, destaque = false }:
  { rotulo: string; valor: string; nota?: string; href?: string;
    bom?: boolean; alerta?: boolean; destaque?: boolean }) {
  const cor = alerta ? "text-loss" : bom ? "text-gain" : "text-navy";
  const borda = destaque ? "border-navy bg-navy-soft" : "border-stone-light bg-white";
  const conteudo = (
    <>
      <p className="text-sm text-stone">{rotulo}</p>
            {/* text-lg e 4 colunas so no xl: em lg o cartao ficava com 156px para um
          numero de 219px, e o espaco do Intl em "US$ 2.980.000,00" e NAO-QUEBRAVEL,
          entao o texto nao quebra linha — transborda. */}
      <p className={`num mt-1 text-lg font-semibold ${cor}`}>{valor}</p>
      {nota && <p className="mt-1 text-sm text-stone">{nota}</p>}
    </>
  );
  if (!href) return <div className={`rounded-md border p-4 ${borda}`}>{conteudo}</div>;
  return (
    <Link href={href} className={`rounded-md border p-4 hover:bg-navy-soft ${borda}`}>{conteudo}</Link>
  );
}
