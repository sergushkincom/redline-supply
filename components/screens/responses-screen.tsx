'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FormulaReveal } from '@/components/formula';
import { CampaignTabs } from '@/components/screens/review-screen';
import { SourceChip } from '@/components/source-chip';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { displayValue } from '@/lib/display';
import { currentOf } from '@/lib/fields';
import { formatMoney, formatNumber } from '@/lib/format';
import { recipientStats } from '@/lib/home';
import { t } from '@/lib/i18n';
import { applyRules, lowestIds, parseRule, totalCost, type Rule } from '@/lib/scenario';
import { useDemo } from '@/lib/store';
import type { ArticleFieldKey, SeedData, Source, SupplierFieldKey } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ResponsesScreen({ id }: { id: string }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const qty = useDemo((state) => state.qty);
  const setQty = useDemo((state) => state.setQty);
  const [view, setView] = useState<'raw' | 'scenarios'>('raw');
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState('');
  const [ruleError, setRuleError] = useState(false);
  const campaign = data.campaigns.find((item) => item.id === id);
  const template = data.templates.find((item) => item.id === campaign?.templateId);

  const answered = useMemo(
    () => campaign?.recipients.filter((recipient) => recipient.state === 'answered' || recipient.state === 'partial') ?? [],
    [campaign],
  );

  if (!campaign || !template) return <p className="rounded-[12px] bg-white p-8 shadow-card">{t(locale, 'emptyTitle')}</p>;
  const stats = recipientStats(campaign);
  const articles = [...new Set(answered.flatMap((recipient) => recipient.articleIds))]
    .map((articleId) => data.articles.find((article) => article.id === articleId))
    .filter((article) => article !== undefined);

  const scenarioSuppliers = answered
    .filter((recipient) => recipient.state === 'answered')
    .map((recipient) => {
      const supplier = data.suppliers.find((item) => item.id === recipient.supplierId);
      if (!supplier) return null;
      let total = 0;
      for (const articleId of recipient.articleIds) {
        const price = quoted(data.changes, id, recipient.contactId, articleId, 'unitPrice');
        const units = qty[`${id}:${articleId}`] ?? defaultQty(articleId);
        if (typeof price === 'number') total += totalCost(price, units).cents;
      }
      return {
        supplierId: supplier.id,
        contactId: recipient.contactId,
        name: supplier.name,
        rating: supplier.rating,
        paymentTermsDays: Number(currentOf(supplier.fields.paymentTermsDays).value),
        totalCents: total,
        articleIds: recipient.articleIds,
      };
    })
    .filter((item) => item !== null);

  const ranked = applyRules(scenarioSuppliers, rules);
  const visible = new Set(ranked.suppliers.map((supplier) => supplier.supplierId));
  const columns = scenarioSuppliers.filter((supplier) => rules.length === 0 || visible.has(supplier.supplierId));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-card">
      <div className="border-b border-line px-5 pt-4">
        <p className="text-[12px] font-medium text-tertiary">
          <Link href="/requests" className="text-brand">{t(locale, 'requests')}</Link> / {campaign.name}
        </p>
        <CampaignTabs id={id} active="responses" responses={stats.responses} />
        <div className="mt-3 flex gap-2 pb-3">
          <button type="button" className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium', view === 'raw' ? 'bg-brand-soft text-brand' : 'text-secondary')} onClick={() => setView('raw')} aria-pressed={view === 'raw'}>{t(locale, 'raw')}</button>
          <button type="button" className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium', view === 'scenarios' ? 'bg-brand-soft text-brand' : 'text-secondary')} onClick={() => setView('scenarios')} aria-pressed={view === 'scenarios'}>{t(locale, 'scenarios')}</button>
        </div>
      </div>
      {view === 'raw' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {answered.length === 0 ? <p className="px-5 py-8 text-[13px] text-tertiary">{t(locale, 'noAnswers')}</p> : (
            <table className="w-full text-left">
              <caption className="sr-only">{t(locale, 'raw')}</caption>
              <thead className="bg-muted text-[12px] text-tertiary">
                <tr>
                  <th className="px-3 py-2 font-medium">{t(locale, 'contact')}</th>
                  <th className="px-3 py-2 font-medium">{t(locale, 'company')}</th>
                  {template.questions.map((question) => (
                    <th key={question.id} className="px-3 py-2 font-medium">{question.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answered.map((recipient) => {
                  const contact = data.contacts.find((item) => item.id === recipient.contactId);
                  const supplier = data.suppliers.find((item) => item.id === recipient.supplierId);
                  return (
                    <tr key={recipient.contactId} className="border-b border-line align-top" style={{ minHeight: 48 }}>
                      <td className="px-3 py-3 text-[13px]">{contact?.name}</td>
                      <td className="px-3 py-3 text-[13px]"><Link className="text-brand" href={`/suppliers/${recipient.supplierId}`}>{supplier?.name}</Link></td>
                      {template.questions.map((question, index) => {
                        if (recipient.state === 'partial' && index > 0) return <td key={question.id} className="px-3 py-3 text-tertiary">—</td>;
                        const entityId = question.target.entity === 'supplier' ? recipient.supplierId : recipient.articleIds[0];
                        const change = data.changes.find((item) => item.campaignId === id && item.field === question.target.field && item.entityId === entityId && (item.source.kind !== 'supplier_answer' || item.source.contactId === recipient.contactId));
                        const value = change ? change.to : entityId ? currentValue(data, question.target.entity, entityId, question.target.field) : null;
                        const source: Source = change?.source ?? { kind: 'supplier_answer', requestId: id, contactId: recipient.contactId, at: recipient.lastResponseAt ?? campaign.sentAt ?? data.demoNow };
                        return (
                          <td key={question.id} className="px-3 py-3">
                            <div className="text-[13px] font-medium">{displayValue(question.target.field, value, locale)}</div>
                            <div className="mt-1"><SourceChip source={source} locale={locale} /></div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-[220px] shrink-0 overflow-auto border-r border-line p-3">
            <h2 className="text-[12px] font-medium text-tertiary">{t(locale, 'scenarioVars')}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {articles.map((article) => (
                <li key={article.id}>
                  <label className="text-[12px] text-secondary">
                    {article.partNo}
                    <span className="mt-0.5 block text-tertiary">{t(locale, 'unitsPerYear')}</span>
                    <input
                      type="number"
                      min={1}
                      value={qty[`${id}:${article.id}`] ?? defaultQty(article.id)}
                      onChange={(event) => setQty(`${id}:${article.id}`, Math.max(1, Number(event.target.value) || 1))}
                      className="mt-1 h-[34px] w-full rounded-[6px] border border-line-strong px-2 text-[13px]"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 overflow-auto p-3">
            <form
              className="mb-3 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = parseRule(draft);
                if (!parsed.ok) {
                  setRuleError(true);
                  return;
                }
                setRuleError(false);
                setRules((current) => [...current, parsed.rule]);
                setDraft('');
              }}
            >
              <label className="text-[12px] text-tertiary">
                {t(locale, 'plainRule')}
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t(locale, 'rulePlaceholder')} className="mt-1 h-[34px] w-72 rounded-[6px] border border-line-strong px-2 text-[13px] text-foreground" />
              </label>
              <Button type="submit" variant="secondary">{t(locale, 'applyRule')}</Button>
              {rules.length > 0 ? <Button type="button" variant="ghost" onClick={() => setRules([])}>{t(locale, 'clearFilters')}</Button> : null}
            </form>
            <p className="text-[12px] text-tertiary">{t(locale, 'ruleHelp')}</p>
            {ruleError ? <p className="mt-1 text-[12px] text-danger" role="alert">{t(locale, 'ruleError')}</p> : null}
            {rules.length > 0 ? <p className="mt-2 text-[12px] font-medium">{t(locale, 'appliedRules')}: {ranked.notes.join(', ')}</p> : null}
            {columns.length === 0 ? <p className="mt-6 text-[13px] text-tertiary">{t(locale, 'noAnswers')}</p> : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-left">
                  <caption className="sr-only">{t(locale, 'scenarios')}</caption>
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-[12px] font-medium text-tertiary">{t(locale, 'measures')}</th>
                      {columns.map((supplier) => <th key={supplier.supplierId} className="px-2 py-2 text-[12px] font-medium">{supplier.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-line">
                      <th scope="row" className="px-2 py-3 text-[13px] font-normal text-secondary">{t(locale, 'paymentTerms')}</th>
                      {columns.map((supplier) => <td key={supplier.supplierId} className="px-2 py-3 text-[13px]">{displayValue('paymentTermsDays', supplier.paymentTermsDays, locale)}</td>)}
                    </tr>
                    <tr className="border-t border-line">
                      <th scope="row" className="px-2 py-3 text-[13px] font-normal text-secondary">{t(locale, 'performance')}</th>
                      {columns.map((supplier) => <td key={supplier.supplierId} className="px-2 py-3 text-[13px]" aria-label={`${supplier.rating} / 5`}>{'★'.repeat(supplier.rating)}{'☆'.repeat(5 - supplier.rating)}</td>)}
                    </tr>
                    <ScenarioRow label={t(locale, 'totalCost')} locale={locale} formula="quantity × unit_price" values={columns.map((supplier) => ({ id: supplier.supplierId, amount: supplier.totalCents, text: formatMoney(supplier.totalCents, locale) }))} />
                    {articles.map((article) => {
                      const units = qty[`${id}:${article.id}`] ?? defaultQty(article.id);
                      const prices = columns.map((supplier) => {
                        const price = supplier.articleIds.includes(article.id) ? quoted(data.changes, id, supplier.contactId, article.id, 'unitPrice') : null;
                        return { id: supplier.supplierId, amount: typeof price === 'number' ? price : null, text: typeof price === 'number' ? formatMoney(price, locale) : '—' };
                      });
                      const totals = columns.map((supplier) => {
                        const price = prices.find((item) => item.id === supplier.supplierId)?.amount;
                        if (typeof price !== 'number') return { id: supplier.supplierId, amount: null, text: '—' };
                        const cost = totalCost(price, units);
                        return { id: supplier.supplierId, amount: cost.cents, text: formatMoney(cost.cents, locale), formula: cost.formula, inputs: { quantity: units, unit_price: formatMoney(price, locale) } };
                      });
                      return (
                        <FragmentRows
                          key={article.id}
                          title={`${article.name}`}
                          priceLabel={t(locale, 'unitPrice')}
                          totalLabel={`${t(locale, 'totalCost')} (${formatNumber(units, locale)})`}
                          prices={prices}
                          totals={totals}
                          locale={locale}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioRow({
  label,
  values,
  locale,
  formula,
}: {
  label: string;
  values: { id: string; amount: number | null; text: string }[];
  locale: 'en' | 'de';
  formula?: string;
}) {
  const best = lowestIds(values);
  return (
    <tr className="border-t border-line">
      <th scope="row" className="px-2 py-3 text-[13px] font-normal text-secondary">
        {label}
        {formula ? <span className="mt-1 block"><FormulaReveal locale={locale} formula={formula} inputs={{}} /></span> : null}
      </th>
      {values.map((value) => (
        <td key={value.id} className={cn('px-2 py-3 text-[13px] tabular', best.has(value.id) && value.amount !== null && 'bg-ready-bg text-ready-fg')}>
          {value.text}
          {best.has(value.id) && value.amount !== null ? <span className="ml-2"><Pill tone="ready">{t(locale, 'lowest')}</Pill></span> : null}
        </td>
      ))}
    </tr>
  );
}

function FragmentRows({
  title,
  priceLabel,
  totalLabel,
  prices,
  totals,
  locale,
}: {
  title: string;
  priceLabel: string;
  totalLabel: string;
  prices: { id: string; amount: number | null; text: string }[];
  totals: { id: string; amount: number | null; text: string; formula?: string; inputs?: Record<string, string | number> }[];
  locale: 'en' | 'de';
}) {
  const [open, setOpen] = useState(true);
  const bestPrice = lowestIds(prices);
  const bestTotal = lowestIds(totals);
  return (
    <>
      <tr className="border-t border-line bg-subtle">
        <th scope="colgroup" colSpan={prices.length + 1} className="px-2 py-2 text-left text-[13px] font-medium">
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? '▾' : '▸'} {title}</button>
        </th>
      </tr>
      {open ? (
        <>
          <tr>
            <th scope="row" className="px-2 py-3 text-[13px] font-normal text-secondary">{priceLabel}</th>
            {prices.map((value) => (
              <td key={value.id} className={cn('px-2 py-3 text-[13px] tabular', bestPrice.has(value.id) && 'bg-ready-bg text-ready-fg')}>
                {value.text}
                {bestPrice.has(value.id) ? <span className="ml-2"><Pill tone="ready">{t(locale, 'lowest')}</Pill></span> : null}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-2 py-3 text-[13px] font-normal text-secondary">
              {totalLabel}
              <span className="mt-1 block"><FormulaReveal locale={locale} formula="quantity × unit_price" inputs={totals.find((item) => item.inputs)?.inputs ?? { quantity: 0, unit_price: 0 }} /></span>
            </th>
            {totals.map((value) => (
              <td key={value.id} className={cn('px-2 py-3 text-[13px] tabular', bestTotal.has(value.id) && 'bg-ready-bg text-ready-fg')}>
                {value.text}
                {bestTotal.has(value.id) ? <span className="ml-2"><Pill tone="ready">{t(locale, 'lowest')}</Pill></span> : null}
              </td>
            ))}
          </tr>
        </>
      ) : null}
    </>
  );
}

function quoted(changes: { campaignId: string; entityId: string; field: string; to: unknown; state: string; source: Source }[], campaignId: string, contactId: string, articleId: string, field: string): number | null {
  const change = changes.find((item) => item.campaignId === campaignId && item.entityId === articleId && item.field === field && item.state !== 'rejected' && (item.source.kind !== 'supplier_answer' || item.source.contactId === contactId));
  if (change && typeof change.to === 'number') return change.to;
  return null;
}

function currentValue(data: SeedData, entity: 'supplier' | 'article', entityId: string, field: string): unknown {
  if (entity === 'supplier') {
    const supplier = data.suppliers.find((item) => item.id === entityId);
    return supplier?.fields[field as SupplierFieldKey]?.at(-1)?.value ?? null;
  }
  const article = data.articles.find((item) => item.id === entityId);
  return article?.fields[field as ArticleFieldKey]?.at(-1)?.value ?? null;
}

function defaultQty(articleId: string): number {
  const number = Number(articleId.replace(/\D/g, '')) || 1;
  return [100, 500, 1000, 2000, 10000][number % 5] ?? 1000;
}
