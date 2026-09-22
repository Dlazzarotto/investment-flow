"use client";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { Projeto } from "@/lib/types";

/** Seletor global: troca o projeto mantendo a mesma aba. */
export function SeletorProjeto({ projetos, atualId }: { projetos: Projeto[]; atualId?: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  function trocar(id: string) {
    if (!id) return;
    const sub = atualId && pathname.startsWith(`/projetos/${atualId}`) ? pathname.slice(`/projetos/${atualId}`.length) : "";
    router.push(`/projetos/${id}${sub}`);
  }

  return (
    <label className="block">
      <span className="sr-only">{d.nav.projetoAtivo}</span>
      <select value={atualId ?? ""} onChange={(e) => trocar(e.target.value)}
              className="min-h-touch w-full max-w-md rounded-md border border-white/30 bg-navy-deep px-3 text-base text-white">
        {!atualId && <option value="">{d.nav.escolha}</option>}
        {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.moeda}</option>)}
      </select>
    </label>
  );
}
