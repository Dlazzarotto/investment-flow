import { INTL_LOCALE, type Locale } from "./i18n/config";
import type { Moeda } from "./types";

/** Formatadores dependentes do idioma. Datas ISO são tratadas em UTC para nunca deslocar o dia. */
export function formatadores(locale: Locale) {
  const intl = INTL_LOCALE[locale];
  const dataUTC = (iso: string) => {
    const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, d || 1));
  };
  const numero = (valor: number, casas = 2) =>
    new Intl.NumberFormat(intl, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
  return {
    moeda: (valor: number, moeda: Moeda, compacto = false) =>
      new Intl.NumberFormat(intl, {
        style: "currency", currency: moeda,
        maximumFractionDigits: compacto ? 1 : 2, notation: compacto ? "compact" : "standard",
      }).format(valor),
    numero,
    pct: (valor: number | null, casas = 1) =>
      valor === null || !Number.isFinite(valor) ? "—" : `${numero(valor * 100, casas)} %`,
    data: (iso: string) =>
      new Intl.DateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(dataUTC(iso)),
    mesCurto: (iso: string) => {
      const dt = dataUTC(iso);
      const mes = new Intl.DateTimeFormat(intl, { month: "short", timeZone: "UTC" }).format(dt).replace(".", "");
      return `${mes}/${String(dt.getUTCFullYear()).slice(2)}`;
    },
    mesLongo: (iso: string) =>
      new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(dataUTC(iso)),
  };
}
export type Formatadores = ReturnType<typeof formatadores>;

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}
