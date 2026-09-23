import type { MetadataRoute } from "next";
import { obterD } from "@/lib/i18n/server";

/**
 * Manifest do PWA: é ele que dá nome e ícone quando alguém usa "adicionar à tela
 * de início" no celular. O iPhone não lê os ícones daqui — usa `app/apple-icon.png`,
 * que por isso tem fundo sólido (o iOS compõe transparência sobre preto).
 */
export default function manifest(): MetadataRoute.Manifest {
  const { d } = obterD();
  return {
    name: "Investment-Flow System",
    short_name: "Investment-Flow",
    description: d.meta.descricao,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F7F9",
    theme_color: "#2D3278",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // O Android recorta o ícone em círculo; sem a folga, a ponta da seta some.
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
