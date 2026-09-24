import { sair } from "@/app/actions/auth";
import { obterD } from "@/lib/i18n/server";
import { obterUsuario } from "@/lib/consultas";
import { Lateral, type GrupoNav } from "./Lateral";
import { SeletorProjeto } from "./SeletorProjeto";
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
  const usuario = await obterUsuario();
  const base = projetoAtual ? `/projetos/${projetoAtual.id}` : null;

  // O MENU PRINCIPAL VEM SEMPRE PRIMEIRO, com ou sem projeto aberto. Antes as
  // seções do projeto vinham em cima e empurravam Clientes e Fornecedores para
  // baixo da dobra — no celular era preciso rolar a gaveta para achá-los. O
  // projeto é algo que se ESCOLHE dentro do menu, não algo que reorganiza o
  // menu inteiro.
  const grupos: GrupoNav[] = [{
    titulo: d.nav.geral,
    itens: [
      { href: "/painel", rotulo: d.nav.painel, icone: "📊", exato: true },
      { href: "/projetos", rotulo: d.projetos.titulo, icone: "🗂️", exato: true },
      { href: "/clientes", rotulo: d.nav.clientes, icone: "🤝" },
      { href: "/fornecedores", rotulo: d.nav.fornecedores, icone: "🚚" },
      { href: "/commodities", rotulo: d.nav.commodities, icone: "⛏️" },
      ...(temCarteira ? [{ href: "/carteira", rotulo: d.nav.carteira, icone: "💼" }] : []),
      ...(ehMaster ? [{ href: "/master", rotulo: d.nav.plataforma, icone: "🏢" }] : []),
      { href: "/conta", rotulo: d.nav.conta, icone: "👤" },
    ],
  }];

  // As seções do projeto aberto entram DEPOIS, sob o nome dele.
  if (base && projetoAtual) {
    grupos.push({
      titulo: projetoAtual.nome,
      itens: [
        { href: base, rotulo: d.nav.dashboard, icone: "📊", exato: true },
        // Investimentos é assunto de dono e admin (0006): somem para os demais.
        ...(verInvestimentos ? [
          { href: `${base}/investimentos`, rotulo: d.nav.investimentos, icone: "🏗️" },
          { href: `${base}/aportes`, rotulo: d.nav.aportes, icone: "🤝" },
        ] : []),
        { href: `${base}/vendas`, rotulo: d.nav.vendas, icone: "📦" },
        { href: `${base}/despesas`, rotulo: d.nav.despesas, icone: "🧾" },
        { href: `${base}/custeio`, rotulo: d.nav.custeio, icone: "🧮" },
        { href: `${base}/participantes`, rotulo: d.nav.parceria, icone: "👥" },
      ],
    });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Lateral
        empresa={empresa} usuario={usuario?.email} grupos={grupos}
        seletor={projetos.length > 0 ? <SeletorProjeto projetos={projetos} atualId={projetoAtual?.id} /> : undefined}
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
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
