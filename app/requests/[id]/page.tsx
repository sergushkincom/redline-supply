import { CampaignScreen } from '@/components/screens/campaign-screen';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignScreen id={id} />;
}
