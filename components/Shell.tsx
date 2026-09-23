import Link from "next/link";
import { sair } from "@/app/actions/auth";
import { obterD } from "@/lib/i18n/server";
import { SeletorProjeto } from "./SeletorProjeto";
import { SeletorIdioma } from "./SeletorIdioma";
import { NavProjeto } from "./NavProjeto";
import type { Projeto } from "@/lib/types";

/** Barra superior navy com seletor global de projeto, idioma e abas; área de conteúdo. */
export function Shell({ projetos, projetoAtual, verInvestimentos = false, temCarteira = false, children }:
  { projetos: Projeto[]; projetoAtual?: Projeto; verInvestimentos?: boolean; temCarteira?: boolean; children: React.ReactNode }) {
  const { locale, d } = obterD();
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/projetos" className="text-lg font-semibold tracking-tight">{d.comum.app}</Link>
          <div className="min-w-0 flex-1">
            {projetos.length > 0 && <SeletorProjeto projetos={projetos} atualId={projetoAtual?.id} />}
          </div>
          {temCarteira && (
            <Link href="/carteira" className="btn min-h-touch px-3 text-sm text-white/85 hover:text-white">{d.nav.carteira}</Link>
          )}
          <SeletorIdioma atual={locale} />
          <form action={sair}>
            <button type="submit" className="btn min-h-touch px-3 text-sm text-white/80 hover:text-white">{d.comum.sair}</button>
          </form>
        </div>
        {projetoAtual && <NavProjeto projetoId={projetoAtual.id} verInvestimentos={verInvestimentos} />}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
