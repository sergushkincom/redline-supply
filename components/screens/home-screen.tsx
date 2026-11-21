'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { formatDate } from '@/lib/format';
import { doneToday, expiringDocuments, overdueCampaigns, reportGaps, reviewQueue } from '@/lib/home';
import { t } from '@/lib/i18n';
import { useDemo } from '@/lib/store';

export function HomeScreen() {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const role = useDemo((state) => state.role);
  const reviews = reviewQueue(data, role);
  const overdue = overdueCampaigns(data);
  const expiring = expiringDocuments(data).slice(0, 4);
  const gaps = reportGaps(data).slice(0, 3);
  const done = doneToday(data);
  const user = data.users.find((item) => item.role === role);

  return (
    <div className="h-full overflow-auto pr-1">
      <h1 className="title">{t(locale, 'whatNeeds')}</h1>
      <p className="mt-1 text-[14px] text-secondary">
        {t(locale, 'acting')} {user?.name}. {t(locale, 'whatNeedsBody')}
      </p>
      <p className="mt-1 text-[12px] text-tertiary">{t(locale, 'demoClock')}</p>

      <section className="mt-6" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-[13px] font-medium text-secondary">
          {t(locale, 'reviews')}
        </h2>
        {reviews.length === 0 ? <p className="mt-2 text-[13px] text-tertiary">{t(locale, 'noReviews')}</p> : null}
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {reviews.map((item) => (
            <article key={item.campaignId} className="rounded-[12px] bg-white p-4 shadow-card">
              <Pill tone={item.readyToFinish ? 'ready' : 'wait'}>{item.readyToFinish ? t(locale, 'readyToFinish') : t(locale, 'toReview')}</Pill>
              <h3 className="mt-3 text-[16px] leading-6">{item.name}</h3>
              <p className="mt-1 text-[13px] text-secondary">
                {item.pending > 0 ? t(locale, 'pendingRows', { n: item.pending }) : t(locale, 'readyToFinish')}
                {item.dueAt ? ` · ${t(locale, 'due', { date: formatDate(item.dueAt, locale) })}` : ''}
              </p>
              <Link href={`/requests/${item.campaignId}/review`} className="mt-3 inline-flex">
                <Button>{t(locale, 'reviewAction')}</Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="overdue-heading">
        <h2 id="overdue-heading" className="text-[13px] font-medium text-secondary">
          {t(locale, 'overdue')}
        </h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {overdue.map((campaign) => (
            <article key={campaign.id} className="rounded-[12px] bg-white p-4 shadow-card">
              <Pill tone="bad">{t(locale, 'overdue')}</Pill>
              <h3 className="mt-3 text-[16px] leading-6">{campaign.name}</h3>
              <p className="mt-1 text-[13px] text-secondary">
                {t(locale, 'unfinishedCount', {
                  n: campaign.recipients.filter((recipient) => recipient.state !== 'answered').length,
                })}
              </p>
              <Link href={`/requests/${campaign.id}`} className="mt-3 inline-flex">
                <Button variant="secondary">{t(locale, 'remindAction')}</Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="text-[13px] font-medium text-secondary">
          {t(locale, 'expiring')}
        </h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {expiring.map((document) => {
            const supplier = data.suppliers.find((item) => item.id === document.supplierId);
            return (
              <article key={document.id} className="rounded-[12px] bg-white p-4 shadow-card">
                <Pill tone="wait">{t(locale, 'expiring')}</Pill>
                <h3 className="mt-3 text-[16px] leading-6">{document.name}</h3>
                <p className="mt-1 text-[13px] text-secondary">
                  {supplier?.name} · {document.expiresAt ? t(locale, 'expiresOn', { date: formatDate(document.expiresAt, locale) }) : ''}
                </p>
                <Link href={`/suppliers/${document.supplierId}?tab=details`} className="mt-3 inline-flex">
                  <Button variant="secondary">{t(locale, 'openProfile')}</Button>
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="gaps-heading">
        <h2 id="gaps-heading" className="text-[13px] font-medium text-secondary">
          {t(locale, 'gaps')}
        </h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {gaps.map((gap) => (
            <article key={gap.regulation} className="rounded-[12px] bg-white p-4 shadow-card">
              <Pill tone="bad">{gap.regulation}</Pill>
              <h3 className="mt-3 text-[16px] leading-6">{gap.regulation}</h3>
              <p className="mt-1 text-[13px] text-secondary">
                {t(locale, 'unknownShare', { unknown: gap.unknown, total: gap.total })}
              </p>
              <Link href={`/reports/${gap.regulation.toLowerCase()}`} className="mt-3 inline-flex">
                <Button>{t(locale, 'requestAction')}</Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[12px] bg-white p-4 shadow-card" aria-labelledby="done-heading">
        <h2 id="done-heading" className="text-[13px] font-medium">
          {t(locale, 'doneToday')}
        </h2>
        <p className="mt-1 text-[12px] leading-4 text-tertiary">{t(locale, 'doneQuiet')}</p>
        <ul className="mt-3 flex flex-col gap-2 rounded-[8px] bg-subtle p-3">
          {done.map((item) => (
            <li key={item.id} className="text-[12px] leading-4 text-secondary">
              {item.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
