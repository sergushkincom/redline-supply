'use client';

import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { SourceChip } from '@/components/source-chip';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { Pill } from '@/components/ui/pill';
import { displayValue } from '@/lib/display';
import { approverCount } from '@/lib/fields';
import { formatDate } from '@/lib/format';
import { recipientStats } from '@/lib/home';
import { fieldLabel, t } from '@/lib/i18n';
import { approvalMeter, fieldKey, finishBlock, tally } from '@/lib/review';
import { canRoleDecide, useDemo } from '@/lib/store';
import type { ProposedChange } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ReviewScreen({ id }: { id: string }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const role = useDemo((state) => state.role);
  const decideChange = useDemo((state) => state.decideChange);
  const bulk = useDemo((state) => state.bulk);
  const finish = useDemo((state) => state.finish);
  const campaign = data.campaigns.find((item) => item.id === id);
  const changes = data.changes.filter((change) => change.campaignId === id);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    if (!campaign) return [];
    const map = new Map<string, ProposedChange[]>();
    for (const change of changes) {
      const supplierId =
        change.entity === 'supplier'
          ? change.entityId
          : (campaign.recipients.find((recipient) => recipient.articleIds.includes(change.entityId))?.supplierId ??
            data.articles.find((article) => article.id === change.entityId)?.supplierIds[0] ??
            '');
      const list = map.get(supplierId) ?? [];
      list.push(change);
      map.set(supplierId, list);
    }
    return [...map.entries()];
  }, [campaign, changes, data.articles]);

  if (!campaign) {
    return <p className="rounded-[12px] bg-white p-8 shadow-card">{t(locale, 'emptyTitle')}</p>;
  }

  const stats = recipientStats(campaign);
  const block = finishBlock(role, campaign, changes);
  const acted = new Set(changes.flatMap((change) => change.decisions.map((decision) => decision.userId)));
  const done = campaign.approverIds.filter((userId) => acted.has(userId)).length;
  const needsSecond = changes.some((change) => change.sensitive && change.state === 'to_review' && approverCount(change) === 1);
  const counts = tally(changes);

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[12px] bg-white shadow-card">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line px-5 pt-4">
          <p className="text-[12px] leading-4 font-medium text-tertiary">
            <Link href="/requests" className="text-brand">
              {t(locale, 'requests')}
            </Link>
            <span> / {campaign.name}</span>
          </p>
          <CampaignTabs id={id} active="review" responses={stats.responses} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {campaign.status === 'closed' ? <p className="mx-5 mt-4 rounded-[8px] bg-subtle px-3 py-2 text-[13px] text-secondary">{t(locale, 'closedReview')}</p> : null}
          {changes.length === 0 ? <p className="px-5 py-10 text-[13px] text-tertiary">{t(locale, 'noneYet')}</p> : null}
          <div className="px-3 py-3" onKeyDown={(event) => moveFocus(event)}>
            {groups.map(([supplierId, rows]) => {
              const supplier = data.suppliers.find((item) => item.id === supplierId);
              const groupTally = tally(rows);
              const supplierRows = rows.filter((change) => change.entity === 'supplier');
              const articleIds = [...new Set(rows.filter((change) => change.entity === 'article').map((change) => change.entityId))];
              const isClosed = closed[supplierId];
              return (
                <section key={supplierId} className="mb-3 overflow-hidden rounded-[12px] border border-line">
                  <header className="flex flex-wrap items-center gap-3 bg-subtle px-3 py-2">
                    <button type="button" className="flex items-center gap-2 text-[13px] font-medium" onClick={() => setClosed((state) => ({ ...state, [supplierId]: !state[supplierId] }))} aria-expanded={!isClosed}>
                      {isClosed ? <ChevronRight size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                      {supplier?.name ?? supplierId}
                    </button>
                    <p className="text-[12px] leading-4 font-medium">
                      <span className="text-ready-fg">
                        {groupTally.approved} {t(locale, 'approvedWord')}
                      </span>
                      <span className="text-tertiary"> · </span>
                      <span className="text-bad-fg">
                        {groupTally.rejected} {t(locale, 'rejectedWord')}
                      </span>
                      <span className="text-tertiary"> · </span>
                      <span className="text-secondary">
                        {groupTally.toReview} {t(locale, 'toReview')}
                      </span>
                    </p>
                    <span className="ml-auto flex gap-2">
                      <Menu
                        trigger={<Button variant="secondary">{t(locale, 'approveAll')}</Button>}
                        items={[
                          { id: 'all', label: t(locale, 'approveAll'), onSelect: () => bulk(id, supplierId, 'approve_all') },
                          { id: 'prices', label: t(locale, 'exceptPrices'), onSelect: () => bulk(id, supplierId, 'approve_except_prices') },
                          { id: 'bank', label: t(locale, 'exceptBank'), onSelect: () => bulk(id, supplierId, 'approve_except_bank') },
                        ]}
                      />
                      <Menu
                        trigger={<Button variant="danger">{t(locale, 'rejectAll')}</Button>}
                        items={[
                          { id: 'all', label: t(locale, 'rejectAll'), onSelect: () => bulk(id, supplierId, 'reject_all') },
                          { id: 'prices', label: t(locale, 'rejectPrices'), onSelect: () => bulk(id, supplierId, 'reject_prices') },
                          { id: 'bank', label: t(locale, 'rejectBank'), onSelect: () => bulk(id, supplierId, 'reject_bank') },
                        ]}
                      />
                    </span>
                  </header>
                  {isClosed ? null : (
                    <div>
                      {supplierRows.length > 0 ? (
                        <Section label={t(locale, 'supplierFields')}>
                          {supplierRows.map((change) => (
                            <DiffRow key={change.id} change={change} rows={rows} locale={locale} role={role} requiredApprovals={campaign.requiredApprovals} onDecide={decideChange} closed={campaign.status === 'closed'} />
                          ))}
                        </Section>
                      ) : null}
                      {articleIds.map((articleId) => {
                        const article = data.articles.find((item) => item.id === articleId);
                        const articleRows = rows.filter((change) => change.entityId === articleId);
                        return (
                          <Section key={articleId} label={article ? `${article.name} · ${article.partNo}` : articleId}>
                            {articleRows.map((change) => (
                              <DiffRow key={change.id} change={change} rows={rows} locale={locale} role={role} requiredApprovals={campaign.requiredApprovals} onDecide={decideChange} closed={campaign.status === 'closed'} />
                            ))}
                          </Section>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <p className="sr-only">
            {counts.approved} {t(locale, 'approvedWord')}, {counts.rejected} {t(locale, 'rejectedWord')}
          </p>
        </div>
      </div>
      <aside className="flex w-[300px] shrink-0 flex-col gap-4 border-l border-line p-4">
        <div>
          <h2 className="text-[13px] leading-[18px] font-medium">
            {t(locale, 'requiredApprovals')}{' '}
            <span className={done >= campaign.requiredApprovals ? 'text-ready-fg' : 'text-secondary'}>
              ({Math.min(done, campaign.requiredApprovals)}/{campaign.requiredApprovals})
            </span>
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {campaign.approverIds.map((userId) => {
              const person = data.users.find((item) => item.id === userId);
              const reviewed = acted.has(userId);
              return (
                <li key={userId} className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{person?.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{person?.name}</span>
                  <Pill tone={reviewed ? 'ready' : 'neutral'}>{reviewed ? t(locale, 'reviewed') : t(locale, 'waiting')}</Pill>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-[13px] leading-[18px] text-secondary">{t(locale, 'finishBody')}</p>
        {needsSecond ? (
          <p className="rounded-[8px] bg-wait-bg px-3 py-2 text-[13px] leading-[18px] text-wait-fg">
            <span className="font-medium">{t(locale, 'needSecond')}. </span>
            {t(locale, 'twoApproverSentence')}
          </p>
        ) : null}
        {block === 'need-head' ? <p className="text-[12px] leading-4 text-tertiary">{t(locale, 'headFinishes')}</p> : null}
        <Button data-testid="finish-review" disabled={block !== 'ready'} onClick={() => finish(id)}>
          {t(locale, 'finish')}
        </Button>
        <p className="text-[12px] leading-4 text-tertiary">{formatDate(data.demoNow, locale, true)}</p>
      </aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="border-b border-line bg-white px-3 py-2 text-[12px] leading-4 font-medium text-tertiary">{label}</p>
      {children}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function DiffRow({
  change,
  rows,
  locale,
  role,
  requiredApprovals,
  onDecide,
  closed,
}: {
  change: ProposedChange;
  rows: ProposedChange[];
  locale: 'en' | 'de';
  role: 'buyer' | 'compliance' | 'head';
  requiredApprovals: 1 | 2;
  onDecide: (id: string, decision: 'approve' | 'reject') => void;
  closed: boolean;
}) {
  const conflict = rows.filter((row) => fieldKey(row) === fieldKey(change)).length > 1;
  const changing = JSON.stringify(change.from) !== JSON.stringify(change.to);
  const empty = change.from === null || change.from === undefined || change.from === '';
  const approved = change.state === 'approved' || change.state === 'applied';
  const rejected = change.state === 'rejected';
  const allowed = canRoleDecide(role, change) && !closed && change.state !== 'applied';
  const done = approverCount(change);
  const meter = approvalMeter(change, requiredApprovals);
  const showStrike = changing && !empty;
  const seen = useRef(done);
  const ticks = useRef(0);
  if (done > seen.current) ticks.current += 1;
  seen.current = done;
  const motionTick = ticks.current;

  return (
    <div
      data-testid="review-row"
      data-field={change.field}
      data-motion-tick={motionTick}
      className="grid grid-cols-[minmax(140px,1.1fr)_minmax(120px,1fr)_minmax(140px,1.1fr)_minmax(160px,0.9fr)_92px] items-center gap-2 border-b border-line px-3"
      style={{ minHeight: 48 }}
    >
      <div className="text-[13px] leading-[18px] text-secondary">
        {fieldLabel(locale, change.field)}
        {conflict ? <span className="mt-0.5 block text-[12px] text-wait-fg">{t(locale, 'conflict')}</span> : null}
      </div>
      <div className="min-w-0 text-[13px] leading-[18px] text-tertiary">
        <span
          key={motionTick}
          data-testid="old-value"
          className={cn('inline-block max-w-full truncate', showStrike && 'review-old', showStrike && motionTick > 0 && 'review-strike')}
        >
          {displayValue(change.field, change.from, locale)}
        </span>
      </div>
      <div
        data-testid="proposed-value"
        className={cn(
          'relative isolate rounded-[6px] px-2 py-1 text-[13px] leading-[18px] font-medium',
          approved && 'bg-ready-bg text-ready-fg',
          rejected && 'bg-bad-bg text-bad-fg',
        )}
      >
        {motionTick > 0 && !rejected ? (
          <span key={motionTick} data-testid="value-flash" className="review-flash pointer-events-none absolute inset-0 -z-10 rounded-[6px]" aria-hidden />
        ) : null}
        <span className="relative block truncate">{displayValue(change.field, change.to, locale)}</span>
        {rejected ? <span className="relative ml-2 text-[12px] font-semibold">{t(locale, 'rejectedMark')}</span> : null}
        {approved ? <span className="relative ml-2 text-[12px] font-medium">{t(locale, 'approvedWord')}</span> : null}
        {meter ? <ApprovalMeter changeId={change.id} done={meter.done} need={meter.need} locale={locale} animate={motionTick > 0} /> : null}
        {conflict && !rejected ? <span className="relative mt-0.5 block text-[12px] text-tertiary">{t(locale, 'conflictHint')}</span> : null}
      </div>
      <SourceChip source={change.source} locale={locale} />
      <div className="flex justify-end gap-1">
        <button
          type="button"
          data-review-action="approve"
          data-testid="approve-change"
          aria-label={t(locale, 'approve')}
          aria-pressed={approved}
          disabled={!allowed}
          onClick={() => onDecide(change.id, 'approve')}
          className={cn('inline-flex size-[34px] items-center justify-center rounded-[6px] border', approved ? 'border-ready-dot bg-ready-bg text-ready-dot' : 'border-line-strong bg-white text-secondary')}
        >
          <Check size={16} aria-hidden />
        </button>
        <button
          type="button"
          data-review-action="reject"
          data-testid="reject-change"
          aria-label={t(locale, 'reject')}
          aria-pressed={rejected}
          disabled={!allowed}
          onClick={() => onDecide(change.id, 'reject')}
          className={cn('inline-flex size-[34px] items-center justify-center rounded-[6px] border', rejected ? 'border-bad-dot bg-bad-bg text-bad-dot' : 'border-line-strong bg-white text-secondary')}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ApprovalMeter({
  changeId,
  done,
  need,
  locale,
  animate,
}: {
  changeId: string;
  done: number;
  need: number;
  locale: 'en' | 'de';
  animate: boolean;
}) {
  const pct = need === 0 ? 0 : Math.round((done / need) * 100);
  const [width, setWidth] = useState(() => (animate && !prefersReducedMotion() ? 0 : pct));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setWidth(pct);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setWidth(pct));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [pct]);
  const label = t(locale, 'approvalProgress', { done, need });
  const labelId = `approval-label-${changeId}`;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={need}
      aria-valuenow={done}
      aria-labelledby={labelId}
      data-testid="approval-progress"
      data-done={done}
      data-need={need}
      className="relative mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5"
    >
      <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-line-strong" aria-hidden>
        <span data-testid="approval-fill" className="review-fill block h-full rounded-full bg-ready-dot" style={{ width: `${width}%` }} />
      </span>
      <span id={labelId} className="whitespace-nowrap text-[12px] leading-4 font-medium text-secondary">
        {label}
      </span>
    </div>
  );
}

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-review-action]')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'ArrowDown' ? buttons[index + 1] : buttons[index - 1];
  next?.focus();
}

export function CampaignTabs({ id, active, responses }: { id: string; active: 'overview' | 'responses' | 'review'; responses: number }) {
  const locale = useDemo((state) => state.locale);
  const tabs = [
    { key: 'overview' as const, href: `/requests/${id}`, label: t(locale, 'overview') },
    { key: 'responses' as const, href: `/requests/${id}/responses`, label: `${t(locale, 'responses')} ${responses}` },
    { key: 'review' as const, href: `/requests/${id}/review`, label: t(locale, 'reviewTab') },
  ];
  return (
    <div className="mt-3 flex gap-1" role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={active === tab.key}
          className={cn('rounded-[8px] px-3 py-2 text-[13px] leading-[18px] font-medium', active === tab.key ? 'bg-brand-soft text-brand' : 'text-secondary hover:bg-hover')}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
