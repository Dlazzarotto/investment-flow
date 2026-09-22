import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#2D3278", deep: "#1E2257", soft: "#E9EAF4" },
        orange: { DEFAULT: "#F47B20", deep: "#C95F0E", soft: "#FDEBDD" },
        ink: "#1B1D2A",
        stone: { DEFAULT: "#6B6F80", light: "#D9DBE4", paper: "#F7F7F9" },
        gain: "#1B8A6B",
        loss: "#C8412B",
      },
      fontFamily: { sans: ["var(--font-plex)", "system-ui", "sans-serif"] },
      // Regra de design: nenhum texto visível abaixo de 18 px (o usuário opera no celular).
      // `sm` e `xs` existem só para o texto secundário não quebrar se alguém usar a classe —
      // valem 18 px de propósito. A hierarquia vem de peso e cor (text-stone), não de tamanho.
      fontSize: {
        xs: ["18px", "1.5"],
        sm: ["18px", "1.5"],
        base: ["18px", "1.55"],
        lg: ["21px", "1.4"],
        xl: ["26px", "1.25"],
        "2xl": ["34px", "1.15"],
        "3xl": ["46px", "1.05"],
      },
      minHeight: { touch: "48px" },
    },
  },
  plugins: [],
};
export default config;
