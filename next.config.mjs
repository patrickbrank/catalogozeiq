import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    // Desativa a otimização de imagens pelo servidor da Vercel (evita estourar o limite de 5.000 transformações/mês do plano Hobby)
    // As fotos já estão no formato moderno .webp no Supabase Storage e são servidas diretamente via CDN
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
