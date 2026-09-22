"use client";
import { createContext, useContext } from "react";
import type { Dicionario, Locale } from "./index";

const Ctx = createContext<{ locale: Locale; d: Dicionario } | null>(null);

export function I18nProvider({ locale, d, children }: { locale: Locale; d: Dicionario; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, d }}>{children}</Ctx.Provider>;
}

/** Idioma e dicionário nos componentes cliente. */
export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n precisa estar dentro de <I18nProvider>.");
  return v;
}
