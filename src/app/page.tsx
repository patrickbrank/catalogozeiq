import { getCatalogData } from '@/lib/data/products';
import { getBanners } from '@/lib/data/banners';
import { getStoreSettings } from '@/lib/data/settings';
import { CatalogClient } from '@/components/CatalogClient';

export const revalidate = 60; // Revalida a cada 60 segundos

interface HomePageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const isPreview =
    resolvedParams.preview === 'promo' ||
    resolvedParams.preview === '1' ||
    resolvedParams.preview === 'true' ||
    resolvedParams.preview === '' ||
    resolvedParams.promo === '1' ||
    resolvedParams.promo === 'preview' ||
    resolvedParams.admin === '1';

  const [{ products, categories, departments }, banners, settings] = await Promise.all([
    getCatalogData(),
    getBanners(),
    getStoreSettings(),
  ]);

  return (
    <CatalogClient
      initialProducts={products}
      categories={categories}
      initialDepartments={departments}
      initialBanners={banners}
      initialSettings={settings}
      initialPromoPreview={Boolean(isPreview)}
    />
  );
}
