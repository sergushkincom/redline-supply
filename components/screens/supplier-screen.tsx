'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SourceChip } from '@/components/source-chip';
import { Sparkline } from '@/components/sparkline';
import { Sheet } from '@/components/ui/sheet';
import { Pill } from '@/components/ui/pill';
import { countryMeta, displayValue } from '@/lib/display';
import { currentOf } from '@/lib/fields';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { expiredDocuments, recipientStats } from '@/lib/home';
import { fieldLabel, t } from '@/lib/i18n';
import { useDemo } from '@/lib/store';
import type { FieldVersion, SupplierFieldKey } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = ['activity', 'details', 'people', 'requests'] as const;

export function SupplierScreen({ id, tab }: { id: string; tab: string }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const toggleTask = useDemo((state) => state.toggleTask);
  const supplier = data.suppliers.find((item) => item.id === id);
  const [historyField, setHistoryField] = useState<SupplierFieldKey | null>(null);
  if (!supplier) return <p className="rounded-[12px] bg-white p-8 shadow-card">{t(locale, 'emptyTitle')}</p>;

  const currentTab = TABS.includes(tab as (typeof TABS)[number]) ? tab : 'activity';
  const country = countryMeta(supplier.country, locale);
  const trendUp = (supplier.spendTrend12m.at(-1) ?? 0) >= (supplier.spendTrend12m[0] ?? 0);
  const trendPct = (supplier.spendTrend12m[0] ?? 1) === 0 ? 0 : ((supplier.spendTrend12m.at(-1) ?? 0) - (supplier.spendTrend12m[0] ?? 0)) / (supplier.spendTrend12m[0] || 1);
  const tasks = data.tasks.filter((task) => task.supplierId === id);
  const evaluations = data.evaluations.filter((item) => item.supplierId === id);
  const requests = data.campaigns.filter((campaign) => campaign.recipients.some((recipient) => recipient.supplierId === id));
  const activities = data.activities.filter((item) => item.supplierId === id).sort((a, b) => b.at.localeCompare(a.at));
  const contacts = data.contacts.filter((contact) => contact.supplierId === id);
  const documents = data.documents.filter((document) => document.supplierId === id);
  const expired = new Set(expiredDocuments(data, id).map((document) => document.id));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <span className="flex size-14 items-center justify-center rounded-[12px] bg-brand-soft text-[18px] font-medium text-brand">{supplier.name.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-tertiary">
            <Link href="/suppliers" className="text-brand">{t(locale, 'suppliers')}</Link> / {supplier.name}
          </p>
          <h1 className="title truncate">{supplier.name}</h1>
          <p className="text-[13px] text-secondary">
            {country.flag} {country.name} · <a className="text-brand" href={supplier.website}>{supplier.website.replace('https://', '')}</a>
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[12px] text-tertiary">{t(locale, 'volume')}</p>
          <p className="kpi tabular">{formatMoney(supplier.spend12m, locale)}</p>
          <span className={cn('inline-flex items-center gap-2 text-[12px] font-medium', trendUp ? 'text-ready-fg' : 'text-bad-fg')}>
            <Sparkline values={supplier.spendTrend12m} up={trendUp} />
            {trendUp ? '+' : ''}
            {formatPercent(trendPct, locale, 1)}
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <section className="hidden w-[260px] shrink-0 overflow-auto border-r border-line p-4 lg:block">
          <h2 className="text-[12px] font-medium text-tertiary">{t(locale, 'summary')}</h2>
          <dl className="mt-3 flex flex-col gap-3 text-[13px]">
            <div>
              <dt className="text-tertiary">{t(locale, 'legalName')}</dt>
              <dd>{String(currentOf(supplier.fields.legalName).value)}</dd>
            </div>
            <div>
              <dt className="text-tertiary">{t(locale, 'address')}</dt>
              <dd>{String(currentOf(supplier.fields.address).value)}, {country.name}</dd>
            </div>
            <div>
              <dt className="text-tertiary">{t(locale, 'category')}</dt>
              <dd>{supplier.topCategory}</dd>
            </div>
            <div>
              <dt className="text-tertiary">{t(locale, 'risk')}</dt>
              <dd className="tabular">{supplier.riskScore}/100</dd>
            </div>
          </dl>
          <h2 className="mt-6 text-[12px] font-medium text-tertiary">{t(locale, 'additional')}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {documents.map((document) => (
              <li key={document.id} className="text-[13px]">
                <span className="mono">{document.name}</span>
                {document.expiresAt ? <span className="mt-0.5 block text-[12px] text-tertiary">{formatDate(document.expiresAt, locale)}</span> : null}
                {expired.has(document.id) ? <Pill tone="bad">{t(locale, 'expired')}</Pill> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-line px-4" role="tablist">
            {TABS.map((item) => (
              <Link key={item} href={`/suppliers/${id}?tab=${item}`} role="tab" aria-selected={currentTab === item} className={cn('px-3 py-3 text-[13px] font-medium', currentTab === item ? 'border-b-2 border-brand-fill text-brand' : 'text-secondary')}>
                {t(locale, item === 'requests' ? 'requests' : item)}
              </Link>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {currentTab === 'activity' ? (
              <ol className="flex flex-col gap-3">
                {activities.length === 0 ? <li className="text-[13px] text-tertiary">{t(locale, 'noActivity')}</li> : null}
                {activities.map((item) => (
                  <li key={item.id} className="rounded-[12px] border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium">{item.title}</p>
                      <time className="text-[12px] text-tertiary" dateTime={item.at}>{formatDate(item.at, locale)}</time>
                    </div>
                    {item.body ? <p className="mt-2 whitespace-pre-wrap text-[13px] text-secondary">{item.body}</p> : null}
                    {item.link ? <Link href={item.link} className="mt-2 inline-block text-[13px] font-medium text-brand">{t(locale, 'openProfile')}</Link> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {currentTab === 'details' ? (
              <div className="flex flex-col">
                {(['legal', 'bankDetails', 'complianceSection'] as const).map((section) => (
                  <div key={section} className="mb-4">
                    <h2 className="mb-1 text-[12px] font-medium text-tertiary">{t(locale, section)}</h2>
                    {fieldsFor(section).map((field) => {
                      const version = currentOf(supplier.fields[field]);
                      const open = data.changes.find((change) => change.entity === 'supplier' && change.entityId === id && change.field === field && change.state === 'to_review');
                      return (
                        <div key={field} className="grid grid-cols-[180px_1fr_auto] items-center gap-3 border-b border-line py-3">
                          <span className="text-[13px] text-secondary">{fieldLabel(locale, field)}</span>
                          <span>
                            <span className={cn('text-[13px] font-medium', field === 'iban' && 'mono')}>{displayValue(field, version.value, locale)}</span>
                            <span className="ml-2"><SourceChip source={version.source} locale={locale} /></span>
                            {open ? (
                              <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-wait-fg">
                                <Pill tone="wait">{t(locale, 'openRequestField')}</Pill>
                                <Link href={`/requests/${open.campaignId}/review`} className="font-medium text-brand">{t(locale, 'viewVersions')}</Link>
                              </span>
                            ) : null}
                          </span>
                          <button type="button" className="text-[13px] font-medium text-brand" onClick={() => setHistoryField(field)}>
                            {t(locale, 'history')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}
            {currentTab === 'people' ? (
              <ul className="flex flex-col gap-2">
                {contacts.length === 0 ? <li className="text-[13px] text-tertiary">{t(locale, 'noPeople')}</li> : null}
                {contacts.map((contact) => (
                  <li key={contact.id} className="rounded-[12px] border border-line px-3 py-3">
                    <p className="text-[13px] font-medium">{contact.name}</p>
                    <p className="text-[13px] text-secondary">{contact.role}</p>
                    <p className="mono text-tertiary">{contact.email}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {currentTab === 'requests' ? (
              <ul className="flex flex-col gap-2">
                {requests.map((campaign) => {
                  const stats = recipientStats(campaign);
                  const mine = campaign.recipients.filter((recipient) => recipient.supplierId === id);
                  const answered = mine.filter((recipient) => recipient.state === 'answered').length;
                  return (
                    <li key={campaign.id} className="flex items-center justify-between rounded-[12px] border border-line px-3 py-3">
                      <div>
                        <Link href={`/requests/${campaign.id}`} className="text-[13px] font-medium text-brand">{campaign.name}</Link>
                        <p className="text-[12px] text-tertiary">{t(locale, 'answeredOf', { done: answered, asked: mine.length })} · {stats.responses}/{stats.recipients}</p>
                      </div>
                      <Pill tone={campaign.status === 'closed' ? 'ready' : campaign.status === 'draft' ? 'neutral' : 'wait'}>{t(locale, campaign.status === 'in_review' ? 'inReview' : campaign.status)}</Pill>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
        <aside className="hidden w-[280px] shrink-0 overflow-auto border-l border-line p-4 xl:block">
          <h2 className="text-[13px] font-medium">{t(locale, 'tasks')}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" checked={task.done} aria-label={task.title} onChange={() => toggleTask(task.id)} />
                <span>
                  <span className={task.done ? 'text-tertiary line-through' : ''}>{task.title}</span>
                  <span className="mt-0.5 block"><Pill tone="neutral" dot={false}>{task.group}</Pill></span>
                </span>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-[13px] font-medium">{t(locale, 'evaluations')}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {evaluations.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span>{item.name}</span>
                <Pill tone={item.score < 50 ? 'bad' : 'ready'}>{item.score}/100</Pill>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-[13px] font-medium">{t(locale, 'requests')}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.slice(0, 5).map((campaign) => {
              const owner = data.users.find((user) => user.id === campaign.sentBy);
              const mine = campaign.recipients.filter((recipient) => recipient.supplierId === id);
              const answered = mine.filter((recipient) => recipient.state === 'answered').length;
              return (
                <li key={campaign.id} className="text-[13px]">
                  <Link href={`/requests/${campaign.id}`} className="font-medium text-brand">{campaign.name}</Link>
                  <p className="text-[12px] text-tertiary">{t(locale, 'answeredOf', { done: answered, asked: mine.length })} · {owner?.name.slice(0, 2).toUpperCase()}</p>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
      <Sheet open={historyField !== null} onOpenChange={(open) => !open && setHistoryField(null)} title={historyField ? fieldLabel(locale, historyField) : ''} description={t(locale, 'historyHint')} locale={locale}>
        {historyField ? <HistoryList supplierId={id} field={historyField} /> : null}
      </Sheet>
    </div>
  );
}

function fieldsFor(section: 'legal' | 'bankDetails' | 'complianceSection'): SupplierFieldKey[] {
  if (section === 'legal') return ['legalName', 'address', 'vatId'];
  if (section === 'bankDetails') return ['bankName', 'iban', 'paymentTermsDays'];
  return ['reachStatus', 'rohsStatus', 'lksgSelfAssessment'];
}

function HistoryList({ supplierId, field }: { supplierId: string; field: SupplierFieldKey }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const supplier = data.suppliers.find((item) => item.id === supplierId);
  if (!supplier) return null;
  const versions = supplier.fields[field];
  const rejected = data.changes.filter((change) => change.entity === 'supplier' && change.entityId === supplierId && change.field === field && change.state === 'rejected');
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((version, index) => (
        <HistoryItem key={`${version.validFrom}-${index}`} version={version} field={field} locale={locale} names={namesFor(data.users, version.approvedBy)} />
      ))}
      {rejected.map((change) => (
        <li key={change.id} className="rounded-[8px] bg-bad-bg px-3 py-2 text-[13px] text-bad-fg">
          <span className="font-medium">{t(locale, 'rejectedMark')}. </span>
          {displayValue(field, change.to, locale)}
        </li>
      ))}
    </ol>
  );
}

function HistoryItem({ version, field, locale, names }: { version: FieldVersion; field: string; locale: 'en' | 'de'; names: string }) {
  return (
    <li className="rounded-[8px] border border-line px-3 py-2">
      <p className="text-[13px] font-medium">{displayValue(field, version.value, locale)}</p>
      <div className="mt-1"><SourceChip source={version.source} locale={locale} /></div>
      <p className="mt-1 text-[12px] text-tertiary">{names ? t(locale, 'approvedBy', { names }) : t(locale, 'notApproved')}</p>
      <p className="text-[12px] text-tertiary">{formatDate(version.validFrom, locale, true)}</p>
    </li>
  );
}

function namesFor(users: { id: string; name: string }[], ids: string[]): string {
  return ids.map((id) => users.find((user) => user.id === id)?.name ?? id).join(', ');
}
