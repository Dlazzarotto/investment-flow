import Link from "next/link";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { PainelEmpresa as Painel } from "@/lib/types";

/**
 * O dashboard do ADM: a empresa inteira, não um projeto.
 *
 * As contagens vêm da primeira linha (empresa não tem moeda); o dinheiro sai
 * por moeda, e com uma moeda só — o caso normal — fica igual a um painel comum.
 */
export function PainelEmpresa({ painel }: { painel: Painel[] }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const t = d.painel;
  const c = painel[0];

  return (
    <>
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

      {painel.map((p) => (
        <section key={p.moeda} className="secao">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="mb-0">{t.resultado}</h2>
            {painel.length > 1 && <span className="text-stone">{p.moeda}</span>}
          </div>
          {/* Uma coluna no celular: em duas, "US$ 2.980.000,00" nao cabe em
              tamanho legivel num telefone de 391px. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao rotulo={t.receita} valor={f.moeda(Number(p.receita), p.moeda)}
                    nota={fmtTexto(t.vendasQtd, { n: p.vendas_qtd })} bom />
            <Cartao rotulo={t.receitaMes} valor={f.moeda(Number(p.receita_mes), p.moeda)} />
            <Cartao rotulo={t.saida} valor={f.moeda(Number(p.saida), p.moeda)} nota={t.saidaNota} />
            <Cartao rotulo={t.saldo} valor={f.moeda(Number(p.saldo), p.moeda)}
                    bom={Number(p.saldo) >= 0} alerta={Number(p.saldo) < 0} destaque />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Cartao rotulo={d.nav.investimentos} valor={f.moeda(Number(p.investimento), p.moeda)} />
            <Cartao rotulo={d.dashboard.custoVendas} valor={f.moeda(Number(p.custo_vendas), p.moeda)} />
            <Cartao rotulo={d.nav.despesas} valor={f.moeda(Number(p.despesas), p.moeda)} />
          </div>
        </section>
      ))}

      {/* O que o usuário pediu e o sistema ainda não sabe responder. Dizer isso
          na tela é melhor do que mostrar um zero que parece um número real. */}
      <section className="secao">
        <div className="rounded-md border-l-4 border-orange bg-orange/5 px-4 py-3">
          <p className="font-semibold text-navy">{t.faltaTitulo}</p>
          <p className="mt-1">{t.faltaTexto}</p>
        </div>
      </section>
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
