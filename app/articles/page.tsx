import { Suspense } from 'react';
import { SuppliersScreen } from '@/components/screens/suppliers-screen';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuppliersScreen mode="articles" />
    </Suspense>
  );
}
