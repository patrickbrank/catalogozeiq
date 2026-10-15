import { getCatalogData } from '@/lib/data/products';
import { CatalogClient } from '@/components/CatalogClient';

export const revalidate = 60; // Revalida a cada 60 segundos

export default async function HomePage() {
  const { products, categories, departments } = await getCatalogData();

  return (
    <CatalogClient
      initialProducts={products}
      categories={categories}
      initialDepartments={departments}
    />
  );
}
