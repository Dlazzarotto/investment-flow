"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export function NavProjeto({ projetoId, verInvestimentos }: { projetoId: string; verInvestimentos: boolean }) {
  const { d } = useI18n();
  const pathname = usePathname();
  const base = `/projetos/${projetoId}`;
  const abas = [
    { seg: "", rotulo: d.nav.dashboard },
    // Investimentos é assunto de dono e admin (0006): a aba some para os demais.
    ...(verInvestimentos ? [{ seg: "/investimentos", rotulo: d.nav.investimentos }] : []),
    { seg: "/vendas", rotulo: d.nav.vendas },
    { seg: "/despesas", rotulo: d.nav.despesas },
    { seg: "/participantes", rotulo: d.nav.parceria },
  ];
  return (
    <nav aria-label={d.nav.secoes} className="border-t border-white/15">
      <ul className="mx-auto flex max-w-6xl overflow-x-auto px-2 sm:px-4">
        {abas.map((a) => {
          const href = base + a.seg;
          const ativo = a.seg === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={a.seg} className="shrink-0">
              <Link href={href} aria-current={ativo ? "page" : undefined}
                    className={`block min-h-touch px-4 py-3 text-base ${ativo
                      ? "border-b-4 border-orange font-semibold text-white"
                      : "border-b-4 border-transparent text-white/75 hover:text-white"}`}>
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
