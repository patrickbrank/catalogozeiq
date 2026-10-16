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
  icons: {
    icon: [
      { url: '/images/logo-zeiq-icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/logo-zeiq-icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/logo-zeiq-icon.png', sizes: '296x296', type: 'image/png' },
    ],
    shortcut: '/images/logo-zeiq-icon.png',
    apple: '/images/logo-zeiq-icon.png',
  },
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
      <head>
        <link rel="preconnect" href="https://hhgiodgcsvioulevorud.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://hhgiodgcsvioulevorud.supabase.co" />
        <link rel="preconnect" href="https://catalogozeiq.com.br" crossOrigin="" />
        <link rel="dns-prefetch" href="https://catalogozeiq.com.br" />
      </head>
      <body className="min-h-screen flex flex-col bg-zeiq-light text-zeiq-black font-sans selection:bg-zeiq-black selection:text-white">
        {children}
        <QuoteDrawer />
      </body>
    </html>
  );
}
