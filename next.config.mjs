/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A fonte é carregada pelo <link> em runtime; sem otimização em build para não depender de rede no CI.
  optimizeFonts: false,
  experimental: { serverComponentsExternalPackages: ["exceljs"] },
};
export default nextConfig;
