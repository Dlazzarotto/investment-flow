export const LOCALES = ["pt", "en", "es", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_PADRAO: Locale = "pt";
export const COOKIE_IDIOMA = "idioma";

/** Locale BCP-47 usado pelo Intl para cada idioma da interface. */
export const INTL_LOCALE: Record<Locale, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", zh: "zh-CN" };

/** Nome de cada idioma, escrito no próprio idioma (para o seletor). */
export const NOME_IDIOMA: Record<Locale, string> = { pt: "Português", en: "English", es: "Español", zh: "中文" };

/** Nome do idioma em inglês, usado nas instruções ao modelo de IA. */
export const IDIOMA_PARA_IA: Record<Locale, string> = {
  pt: "Brazilian Portuguese", en: "English", es: "Spanish", zh: "Simplified Chinese",
};

export function ehLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Escolhe o idioma a partir do cabeçalho Accept-Language (primeira visita, sem cookie). */
export function detectarLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return LOCALE_PADRAO;
  for (const parte of acceptLanguage.split(",")) {
    const tag = parte.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if (ehLocale(base)) return base;
  }
  return LOCALE_PADRAO;
}
