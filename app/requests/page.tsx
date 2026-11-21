import { Suspense } from 'react';
import { RequestsScreen } from '@/components/screens/requests-screen';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequestsScreen />
    </Suspense>
  );
}
