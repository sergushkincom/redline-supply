import { notFound } from 'next/navigation';
import { ReportScreen } from '@/components/screens/report-screen';
import { asRegulation } from '@/lib/coverage';

export default async function Page({ params }: { params: Promise<{ regulation: string }> }) {
  const { regulation } = await params;
  const parsed = asRegulation(regulation);
  if (!parsed) notFound();
  return <ReportScreen regulation={parsed} />;
}
