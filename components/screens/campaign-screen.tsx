'use client';

import Link from 'next/link';
import { CampaignTabs } from '@/components/screens/review-screen';
import { Button } from '@/components/ui/button';
import { Pill, type PillTone } from '@/components/ui/pill';
import { formatDate } from '@/lib/format';
import { recipientStats } from '@/lib/home';
import { t } from '@/lib/i18n';
import { useDemo } from '@/lib/store';
import type { Recipient } from '@/lib/types';

const TONE: Record<Recipient['state'], PillTone> = {
  sent: 'neutral',
  opened: 'brand',
  partial: 'wait',
  answered: 'ready',
  bounced: 'bad',
};

export function CampaignScreen({ id }: { id: string }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const remind = useDemo((state) => state.remind);
  const closeCampaign = useDemo((state) => state.closeCampaign);
  const campaign = data.campaigns.find((item) => item.id === id);
  if (!campaign) return <p className="rounded-[12px] bg-white p-8 shadow-card">{t(locale, 'emptyTitle')}</p>;
  const stats = recipientStats(campaign);
  const template = data.templates.find((item) => item.id === campaign.templateId);
  const sender = data.users.find((user) => user.id === campaign.sentBy);

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[12px] bg-white shadow-card">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line px-5 pt-4">
          <p className="text-[12px] font-medium text-tertiary">
            <Link href="/requests" className="text-brand">{t(locale, 'requests')}</Link> / {campaign.name}
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="title">{campaign.name}</h1>
            <div className="flex gap-6">
              <Kpi label={t(locale, 'recipients')} value={stats.recipients} />
              <Kpi label={t(locale, 'responsesKpi')} value={stats.responses} tone="ready" />
              <Kpi label={t(locale, 'unfinished')} value={stats.unfinished} />
            </div>
          </div>
          <CampaignTabs id={id} active="overview" responses={stats.responses} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {campaign.recipients.length === 0 ? <p className="px-5 py-8 text-[13px] text-tertiary">{t(locale, 'emptyCampaigns')}</p> : null}
          <table className="w-full text-left">
            <caption className="sr-only">{t(locale, 'recipients')}</caption>
            <thead className="bg-muted text-[12px] text-tertiary">
              <tr>
                <th className="px-4 py-2 font-medium">{t(locale, 'latest')}</th>
                <th className="px-3 py-2 font-medium">{t(locale, 'contact')}</th>
                <th className="px-3 py-2 font-medium">{t(locale, 'company')}</th>
                <th className="px-3 py-2 font-medium">{t(locale, 'status')}</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((recipient) => {
                const contact = data.contacts.find((item) => item.id === recipient.contactId);
                const supplier = data.suppliers.find((item) => item.id === recipient.supplierId);
                const stateKey = recipient.state === 'answered' ? 'answered' : recipient.state === 'partial' ? 'partialState' : recipient.state;
                return (
                  <tr key={`${recipient.contactId}-${recipient.supplierId}`} className="border-b border-line" style={{ height: 48 }}>
                    <td className="px-4 text-[13px] text-secondary">{recipient.lastResponseAt ? formatDate(recipient.lastResponseAt, locale, true) : '—'}</td>
                    <td className="px-3 text-[13px]">{contact?.name}</td>
                    <td className="px-3 text-[13px]"><Link className="text-brand" href={`/suppliers/${recipient.supplierId}`}>{supplier?.name}</Link></td>
                    <td className="px-3"><Pill tone={TONE[recipient.state]}>{t(locale, stateKey)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-l border-line p-4">
        <h2 className="text-[13px] font-medium">{t(locale, 'campaignDetails')}</h2>
        <p className="text-[12px] text-tertiary">{t(locale, 'sentOn')}</p>
        <p className="text-[13px]">{campaign.sentAt ? formatDate(campaign.sentAt, locale, true) : t(locale, 'draft')}</p>
        <p className="text-[12px] text-tertiary">{t(locale, 'sentBy')}</p>
        <p className="text-[13px]">{sender?.name}</p>
        <p className="text-[12px] text-tertiary">{t(locale, 'approvers')}</p>
        <ul className="text-[13px]">
          {campaign.approverIds.map((userId) => <li key={userId}>{data.users.find((user) => user.id === userId)?.name}</li>)}
        </ul>
        <p className="text-[12px] text-tertiary">{t(locale, 'tags')}</p>
        <div className="flex flex-wrap gap-1">{campaign.tags.map((tag) => <Pill key={tag} tone="neutral">{tag}</Pill>)}</div>
        <p className="text-[12px] text-tertiary">{t(locale, 'template')}</p>
        <p className="text-[13px]">{template?.name} {template?.version}</p>
        <Button variant="secondary" onClick={() => remind(id)} disabled={campaign.status === 'draft' || campaign.status === 'closed'}>{t(locale, 'remind')}</Button>
        <Button variant="danger" onClick={() => closeCampaign(id)} disabled={campaign.status === 'closed'}>{t(locale, 'closeCampaign')}</Button>
        {campaign.lastRemindedAt ? <p className="text-[12px] text-tertiary">{t(locale, 'reminderDraft')}</p> : null}
      </aside>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'ready' }) {
  return (
    <div>
      <p className="text-[12px] text-tertiary">{label}</p>
      <p className={tone === 'ready' ? 'kpi tabular text-ready-fg' : 'kpi tabular'}>{value}</p>
    </div>
  );
}
