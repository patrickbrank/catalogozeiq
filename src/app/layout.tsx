import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QuoteDrawer } from '@/components/QuoteDrawer';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Zeiq - Catálogo Oficial de Revenda e Cotação',
  description: 'Catálogo de Beach Tennis, moda esportiva e acessórios da Zeiq para revenda e atacado. Monte seu pedido e solicite cotação direta via WhatsApp.',
  openGraph: {
    title: 'Zeiq - Catálogo Oficial de Revenda',
    description: 'Catálogo oficial de Beach Tennis e vestuário esportivo para revenda e atacado.',
    siteName: 'Zeiq Sports',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-zeiq-light text-zeiq-black font-sans selection:bg-zeiq-black selection:text-white">
        {children}
        <QuoteDrawer />
      </body>
    </html>
  );
}
