import { cookies, headers } from "next/headers";
import { COOKIE_IDIOMA, detectarLocale, ehLocale, obterDicionario, type Locale } from "./index";

/** Idioma da requisição atual (cookie definido pelo middleware/seletor; fallback: Accept-Language). */
export function obterLocale(): Locale {
  const c = cookies().get(COOKIE_IDIOMA)?.value;
  if (ehLocale(c)) return c;
  return detectarLocale(headers().get("accept-language"));
}

export function obterD() {
  const locale = obterLocale();
  return { locale, d: obterDicionario(locale) };
}
