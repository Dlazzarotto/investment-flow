"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export interface ItemNav { href: string; rotulo: string; icone: string; exato?: boolean }
export interface GrupoNav { titulo?: string; itens: ItemNav[] }

interface Props {
  empresa?: string | null;
  usuario?: string | null;
  grupos: GrupoNav[];
  /** Idioma e sair, no pé da barra. */
  rodape: React.ReactNode;
}

/**
 * Barra lateral fixa com a marca, o contexto e a navegação.
 *
 * No celular ela vira gaveta: a barra some e fica um cabeçalho com o botão de
 * menu. Sem isso, 256 px de lateral numa tela de 375 px não sobra nada para o
 * conteúdo — e é do celular que este sistema mais é usado.
 */
export function Lateral({ empresa, usuario, grupos, rodape }: Props) {
  const { d } = useI18n();
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();

  const conteudo = (
    <div className="flex h-full flex-col overflow-y-auto bg-navy text-white">
      <div className="border-b border-white/15 px-5 py-4">
        <Link href="/projetos" className="flex items-center gap-2" onClick={() => setAberta(false)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white">
            <Image src="/icone.png" alt="" width={208} height={208} className="h-8 w-8" priority />
          </span>
          <span className="text-lg font-semibold tracking-tight">Investment-Flow</span>
        </Link>
        {empresa && <p className="mt-2 text-sm text-white/80">{empresa}</p>}
        {usuario && <p className="break-all text-sm text-white/60">{usuario}</p>}
      </div>

      <nav aria-label={d.nav.secoes} className="flex-1 px-2 py-3">
        {grupos.map((g, i) => (
          <div key={g.titulo ?? i} className={i > 0 ? "mt-4" : ""}>
            {g.titulo && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/50">{g.titulo}</p>
            )}
            <ul>
              {g.itens.map((item) => {
                const ativo = item.exato ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={ativo ? "page" : undefined}
                          onClick={() => setAberta(false)}
                          className={`flex min-h-touch items-center gap-3 rounded-md px-3 text-base ${ativo
                            ? "bg-white/15 font-semibold text-white"
                            : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                      <span aria-hidden className="w-6 text-center text-lg">{item.icone}</span>
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/15 px-5 py-4">{rodape}</div>
    </div>
  );

  return (
    <>
      {/* Celular: cabeçalho com o botão que abre a gaveta. */}
      <header className="flex items-center gap-3 bg-navy px-4 py-2 text-white lg:hidden">
        <button type="button" onClick={() => setAberta(true)} aria-expanded={aberta}
                className="btn min-h-touch px-3 text-white" aria-label={d.nav.abrirMenu}>
          <span aria-hidden className="text-2xl">☰</span>
        </button>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white">
          <Image src="/icone.png" alt="" width={208} height={208} className="h-7 w-7" />
        </span>
        <span className="truncate text-lg font-semibold">Investment-Flow</span>
      </header>

      {aberta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={d.comum.cancelar} onClick={() => setAberta(false)}
                  className="absolute inset-0 bg-ink/50" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">{conteudo}</div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{conteudo}</div>
      </aside>
    </>
  );
}
