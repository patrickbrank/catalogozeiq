import { BannerItem, StoreSettings } from '@/types';

export const DEFAULT_BANNERS: BannerItem[] = [
  {
    id: 'banner-leo-branco',
    title: 'Black Edition Light • Leo Branco',
    desktopImage: '/images/banners/banner-leo-branco-desktop.webp',
    mobileImage: '/images/banners/banner-leo-branco-mobile.webp',
    link: '?search=Leo+Branco',
    isActive: true,
    order: 1,
  },
  {
    id: 'banner-favoritos',
    title: 'Favoritos dos Atletas • Zeiq Sports',
    desktopImage: '/images/banners/banner-favoritos-desktop.webp',
    mobileImage: '/images/banners/banner-favoritos-mobile.webp',
    link: '?dept=equipamentos&cat=raquetes',
    isActive: true,
    order: 2,
  },
];

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@zeiq.com.br',
  siteName: 'Zeiq Sports',
};
