import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    // Desativa a otimização de imagens pelo servidor da Vercel (evita estourar o limite de 5.000 transformações/mês do plano Hobby)
    // As fotos são otimizadas automaticamente no upload (WebP 1200px + miniatura 480px via sharp) com Cache-Control de 1 ano
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'catalogozeiq.com.br',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
