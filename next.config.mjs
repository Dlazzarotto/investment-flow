/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A fonte é carregada pelo <link> em runtime; sem otimização em build para não depender de rede no CI.
  optimizeFonts: false,
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
  webpack: (config) => {
    // O cache do webpack avisa "Serializing big strings" para os chunks grandes (recharts, middleware).
    // É só desempenho do cache de build, não do app; deixa o build limpo sem esconder avisos de compilação.
    config.infrastructureLogging = { ...config.infrastructureLogging, level: "error" };
    return config;
  },
};
export default nextConfig;
