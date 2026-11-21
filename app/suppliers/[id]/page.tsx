import { SupplierScreen } from '@/components/screens/supplier-screen';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <SupplierScreen id={id} tab={tab ?? 'activity'} />;
}
