import { definirIdioma } from "@/app/actions/idioma";
import { obterD } from "@/lib/i18n/server";
import { LOCALES, NOME_IDIOMA, type Locale } from "@/lib/i18n/config";
import { SelectAutoSubmit } from "./ui/SelectAutoSubmit";

/** Troca de idioma: <select> que envia a server action ao mudar (cookie + revalidação). */
export function SeletorIdioma({ atual, escuro = true }: { atual: Locale; escuro?: boolean }) {
  const { d } = obterD();
  return (
    <form action={definirIdioma}>
      <SelectAutoSubmit
        name="idioma" defaultValue={atual} ariaLabel={d.comum.idioma}
        className={escuro
          ? "min-h-touch rounded-md border border-white/30 bg-navy-deep px-3 text-base text-white"
          : "min-h-touch rounded-md border border-stone-light bg-white px-3 text-base text-ink"}
      >
        {LOCALES.map((l) => <option key={l} value={l}>{NOME_IDIOMA[l]}</option>)}
      </SelectAutoSubmit>
    </form>
  );
}
