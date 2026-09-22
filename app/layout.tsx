import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/client";
import { obterD } from "@/lib/i18n/server";

export function generateMetadata(): Metadata {
  const { d } = obterD();
  return { title: d.meta.titulo, description: d.meta.descricao };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2D3278" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, d } = obterD();
  return (
    <html lang={locale === "pt" ? "pt-BR" : locale === "zh" ? "zh-CN" : locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider locale={locale} d={d}>{children}</I18nProvider>
      </body>
    </html>
  );
}
