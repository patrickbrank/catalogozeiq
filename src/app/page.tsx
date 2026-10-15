import { getCatalogData } from '@/lib/data/products';
import { getBanners } from '@/lib/data/banners';
import { getStoreSettings } from '@/lib/data/settings';
import { CatalogClient } from '@/components/CatalogClient';

export const revalidate = 60; // Revalida a cada 60 segundos

export default async function HomePage() {
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
    />
  );
}
