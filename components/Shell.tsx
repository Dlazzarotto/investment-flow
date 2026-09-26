import { sair } from "@/app/actions/auth";
import { obterD } from "@/lib/i18n/server";
import { acessoSuspenso, listarCarteira, minhaEmpresaBloqueada, minhaOrganizacao, obterUsuario } from "@/lib/consultas";
import { fmtTexto } from "@/lib/i18n";
import { Lateral, type GrupoNav } from "./Lateral";
import { SeletorIdioma } from "./SeletorIdioma";
import type { Projeto } from "@/lib/types";

interface Props {
  projetos: Projeto[];
  projetoAtual?: Projeto;
  verInvestimentos?: boolean;
  temCarteira?: boolean;
  ehMaster?: boolean;
  /** Nome da empresa, sob a marca. */
  empresa?: string | null;
  children: React.ReactNode;
}

/**
 * Moldura da aplicação: barra lateral com marca, contexto e navegação; o
 * conteúdo ao lado.
 *
 * A navegação do projeto passou das abas do topo para a lateral. Em abas ela
 * competia por espaço com o seletor de projeto e já não cabia seção nova —
 * justamente o que a reorganização vai acrescentar (clientes, fornecedores,
 * commodities, documentos).
 */
export async function Shell({ projetos, projetoAtual, verInvestimentos = false,
                              temCarteira = false, ehMaster = false, empresa, children }: Props) {
  const { locale, d } = obterD();
  const [usuario, org, suspenso, carteira, bloqueada] = await Promise.all([
    obterUsuario(), minhaOrganizacao(), acessoSuspenso(), listarCarteira(), minhaEmpresaBloqueada()]);
  // Quem não é ADM de empresa (investidor, membro só de projeto, master) não tem
  // nada nas telas da empresa: mostrar Vendas, Clientes… a ele era mostrar becos
  // que redirecionam ou abrem vazios.
  const daEmpresa = org !== null;
  const base = projetoAtual ? `/projetos/${projetoAtual.id}` : null;

  // O MENU PRINCIPAL VEM SEMPRE PRIMEIRO, com ou sem projeto aberto. Antes as
  // seções do projeto vinham em cima e empurravam Clientes e Fornecedores para
  // baixo da dobra — no celular era preciso rolar a gaveta para achá-los. O
  // projeto é algo que se ESCOLHE dentro do menu, não algo que reorganiza o
  // menu inteiro.
  // Empresa parada ou arquivada (0034): o banco já não entrega nada; a lateral só
  // oferece a conta, e o conteúdo dá lugar ao aviso — sem becos vazios.
  const grupos: GrupoNav[] = bloqueada ? [{ titulo: d.nav.geral, itens: [{ href: "/conta", rotulo: d.nav.conta, icone: "👤" }] }] : [{
    titulo: d.nav.geral,
    itens: [
      ...(daEmpresa ? [
        { href: "/painel", rotulo: d.nav.painel, icone: "📊", exato: true },
        { href: "/vendas", rotulo: d.nav.vendasMenu, icone: "📤" },
        { href: "/compras", rotulo: d.nav.compras, icone: "📥" },
        { href: "/propostas", rotulo: d.nav.propostas, icone: "🧮" },
      ] : []),
      // Projetos: para a empresa e para quem trabalha em algum projeto (mesma regra de
      // /projetos, que manda o investidor puro para a carteira).
      ...(daEmpresa || projetos.some((p) => p.owner_id === usuario?.id || !carteira.some((c) => c.projeto_id === p.id)) ? [{ href: "/projetos", rotulo: d.projetos.titulo, icone: "🗂️" }] : []),
      ...(daEmpresa ? [
        { href: "/clientes", rotulo: d.nav.clientes, icone: "🤝" },
        { href: "/fornecedores", rotulo: d.nav.fornecedores, icone: "🚚" },
        { href: "/commodities", rotulo: d.nav.commodities, icone: "⛏️" },
        { href: "/locais", rotulo: d.nav.locais, icone: "📍" },
      ] : []),
      ...(temCarteira || carteira.length > 0 ? [{ href: "/carteira", rotulo: d.nav.carteira, icone: "💼" }] : []),
      ...(ehMaster ? [{ href: "/master", rotulo: d.nav.plataforma, icone: "🏢" }] : []),
      { href: "/conta", rotulo: d.nav.conta, icone: "👤" },
    ],
  }];

  // As seções do projeto aberto entram DEPOIS, sob o nome dele. O projeto é o
  // que a empresa ADMINISTRA para investidores (0022): resumo, sócios, aportes e
  // custos. Vender, comprar e precificar são da empresa — ficam no menu principal.
  if (base && projetoAtual && !bloqueada) {
    grupos.push({
      titulo: projetoAtual.nome,
      itens: [
        { href: base, rotulo: d.nav.resumo, icone: "📊", exato: true },
        { href: `${base}/participantes`, rotulo: d.nav.socios, icone: "👥" },
        // Aportes e capex são assunto de dono e admin (0006): somem para os demais.
        ...(verInvestimentos ? [{ href: `${base}/aportes`, rotulo: d.nav.aportes, icone: "🤝" }] : []),
        { href: `${base}/despesas`, rotulo: d.nav.custos, icone: "🧾" },
      ],
    });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Lateral
        empresa={empresa} usuario={usuario?.email} grupos={grupos}
        rodape={
          <div className="flex flex-wrap items-center gap-2">
            <SeletorIdioma atual={locale} />
            <form action={sair}>
              <button type="submit" className="btn min-h-touch px-3 text-sm text-white/80 hover:text-white">
                {d.comum.sair}
              </button>
            </form>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          {/* Em TODAS as telas: sem isto a gravação recusada parecia defeito, não suspensão. */}
          {suspenso && (
            <p role="alert" className="mb-6 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3">
              <strong className="text-loss">{d.comum.acessoSuspenso}</strong>
              <span className="mt-1 block">{d.comum.acessoSuspensoTexto}</span>
            </p>
          )}
          {bloqueada ? (
            <section role="alert" className="rounded-md border-l-4 border-loss bg-red-50 px-5 py-6">
              <h1 className="text-2xl text-loss">{d.comum.bloqueioTitulo}</h1>
              <p className="mt-2">{fmtTexto(d.comum.bloqueioTexto, {
                nome: bloqueada.nome, situacao: d.enums.situacaoEmpresa[bloqueada.situacao].toLowerCase() })}</p>
            </section>
          ) : children}
        </div>
      </main>
    </div>
  );
}
