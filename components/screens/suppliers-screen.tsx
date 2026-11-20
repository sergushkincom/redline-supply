'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DataGrid, type GridColumn } from '@/components/data-grid';
import { Sparkline, SpendBar } from '@/components/sparkline';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { Pill } from '@/components/ui/pill';
import { countryMeta, displayValue } from '@/lib/display';
import { currentOf } from '@/lib/fields';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { t, type CopyKey } from '@/lib/i18n';
import { useDemo } from '@/lib/store';
import type { Article, Supplier } from '@/lib/types';
import { cn } from '@/lib/utils';

const SUPPLIER_COLUMNS = ['name', 'country', 'category', 'risk', 'spend', 'trend', 'rating', 'openRequests', 'lastAnswer', 'reach', 'rohs', 'lksg', 'paymentTerms', 'city', 'vat', 'bank', 'contacts', 'website', 'tags', 'rank', 'co2eCoverage', 'articleCount', 'legalName', 'iban'] as const;

const DEFAULT_COLUMNS = ['name', 'country', 'category', 'risk', 'spend', 'trend', 'rating', 'openRequests', 'lastAnswer', 'reach', 'rohs'];

export function SuppliersScreen({ mode }: { mode: 'suppliers' | 'articles' }) {
  const router = useRouter();
  const params = useSearchParams();
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const query = params.get('q') ?? '';
  const view = params.get('view') ?? 'mine';
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [columns, setColumns] = useState<string[]>(view === 'gaps' ? ['name', 'country', 'reach', 'rohs', 'lksg', 'co2eCoverage', 'openRequests', 'risk', 'spend', 'category', 'rating'] : DEFAULT_COLUMNS);
  const [picker, setPicker] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const stats = useMemo(() => buildStats(data.suppliers, data.articles, data.campaigns, data.changes), [data]);
  const filters = readFilters(params);

  let suppliers = data.suppliers.filter((supplier) => {
    if (query && !`${supplier.name} ${supplier.city} ${supplier.topCategory}`.toLowerCase().includes(query.toLowerCase())) return false;
    return filters.every((filter) => matchFilter(supplier, filter, stats));
  });
  if (view === 'top') suppliers = [...suppliers].sort((a, b) => b.spend12m - a.spend12m).slice(0, 20);
  const maxSpend = Math.max(...data.suppliers.map((supplier) => supplier.spend12m), 1);

  const supplierColumns: GridColumn<Supplier>[] = SUPPLIER_COLUMNS.map((id) => ({
    id,
    header: t(locale, id === 'name' ? 'company' : (id as CopyKey)),
    sortValue: (row) => sortSupplier(row, id, stats),
    cell: (row) => renderSupplierCell(row, id, locale, stats, maxSpend),
  }));

  const articles = data.articles.filter((article) => {
    const supplier = data.suppliers.find((item) => item.id === article.supplierIds[0]);
    const haystack = `${article.partNo} ${article.name} ${supplier?.name ?? ''}`.toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  });
  const articleColumns: GridColumn<Article>[] = [
    { id: 'partNo', header: t(locale, 'partNo'), sortValue: (row) => row.partNo, cell: (row) => <span className="mono">{row.partNo}</span> },
    { id: 'name', header: t(locale, 'articleName'), sortValue: (row) => row.name, cell: (row) => row.name },
    { id: 'cn', header: t(locale, 'cnCode'), sortValue: (row) => row.cnCode, cell: (row) => row.cnCode },
    { id: 'category', header: t(locale, 'category'), sortValue: (row) => row.category, cell: (row) => row.category },
    { id: 'supplier', header: t(locale, 'suppliers'), sortValue: (row) => data.suppliers.find((item) => item.id === row.supplierIds[0])?.name ?? '', cell: (row) => <Link className="text-brand" href={`/suppliers/${row.supplierIds[0]}`}>{data.suppliers.find((item) => item.id === row.supplierIds[0])?.name}</Link> },
    { id: 'price', header: t(locale, 'price'), sortValue: (row) => Number(currentOf(row.fields.unitPrice).value), cell: (row) => <span className="tabular">{formatMoney(Number(currentOf(row.fields.unitPrice).value), locale)}</span> },
    { id: 'moq', header: t(locale, 'moq'), sortValue: (row) => Number(currentOf(row.fields.moq).value), cell: (row) => <span className="tabular">{formatNumber(Number(currentOf(row.fields.moq).value), locale)}</span> },
    { id: 'co2e', header: t(locale, 'co2e'), sortValue: (row) => (currentOf(row.fields.co2eKg).value === null ? 0 : 1), cell: (row) => currentOf(row.fields.co2eKg).value === null ? <Pill tone="bad">{t(locale, 'unknown')}</Pill> : <Pill tone="ready">{t(locale, 'known')}</Pill> },
    { id: 'unit', header: t(locale, 'unit'), sortValue: (row) => row.unit, cell: (row) => row.unit },
  ];

  const selectedIds = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    router.replace(mode === 'articles' ? `/articles?${next}` : `/suppliers?${next}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex rounded-[8px] bg-muted p-0.5">
          <Link href="/suppliers" className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium', mode === 'suppliers' ? 'bg-white text-brand' : 'text-secondary')}>{t(locale, 'suppliers')}</Link>
          <Link href="/articles" className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium', mode === 'articles' ? 'bg-white text-brand' : 'text-secondary')}>{t(locale, 'articles')}</Link>
        </div>
        <input value={query} onChange={(event) => setParam('q', event.target.value)} placeholder={t(locale, 'search')} aria-label={t(locale, 'search')} className="h-[34px] w-56 rounded-[6px] border border-line-strong px-3 text-[13px]" />
        {mode === 'suppliers' ? (
          <Menu
            trigger={<Button variant="secondary">{view === 'gaps' ? t(locale, 'viewGaps') : view === 'top' ? t(locale, 'viewTop') : t(locale, 'viewMine')}</Button>}
            items={[
              { id: 'mine', label: t(locale, 'viewMine'), onSelect: () => { setColumns(DEFAULT_COLUMNS); setParam('view', null); } },
              { id: 'gaps', label: t(locale, 'viewGaps'), onSelect: () => { setColumns(['name', 'country', 'reach', 'rohs', 'lksg', 'co2eCoverage', 'openRequests', 'risk', 'spend', 'category', 'rating']); setParam('view', 'gaps'); setParam('reach', 'unknown'); } },
              { id: 'top', label: t(locale, 'viewTop'), onSelect: () => { setParam('view', 'top'); } },
            ]}
          />
        ) : null}
        {mode === 'suppliers' ? (
          <button type="button" className="h-[34px] rounded-[6px] border border-line-strong px-3 text-[13px] font-semibold" onClick={() => setPicker((value) => !value)}>
            {t(locale, 'columns', { shown: columns.length, total: SUPPLIER_COLUMNS.length })}
          </button>
        ) : null}
        <button type="button" className="text-[13px] font-semibold text-brand" onClick={() => setFilterOpen((value) => !value)}>{t(locale, 'addFilter')}</button>
        {filters.length > 0 ? <button type="button" className="text-[13px] font-semibold text-brand" onClick={() => { setParam('country', null); setParam('reach', null); setParam('risk', null); }}>{t(locale, 'clearFilters')}</button> : null}
        <div className="ml-auto flex gap-2">
          {selectedIds.length > 0 ? <span className="self-center text-[13px] text-secondary">{t(locale, 'selected', { n: selectedIds.length })}</span> : null}
          <Button variant="secondary" onClick={() => downloadCsv(mode, mode === 'suppliers' ? suppliers.filter((supplier) => selectedIds.length === 0 || selectedIds.includes(supplier.id)) : articles.filter((article) => selectedIds.length === 0 || selectedIds.includes(article.id)), data)}>{t(locale, 'exportCsv')}</Button>
          {mode === 'suppliers' ? <Button onClick={() => router.push(`/requests?compose=1&suppliers=${selectedIds.join(',')}`)} disabled={selectedIds.length === 0}>{t(locale, 'requestData')}</Button> : null}
        </div>
      </div>
      {mode === 'suppliers' && filters.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2">
          {filters.map((filter) => (
            <span key={filter.raw} className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-2 py-1 text-[12px] text-brand">
              {filter.label(locale)}
              <button type="button" aria-label={t(locale, 'remove')} onClick={() => setParam(filter.key, null)}>×</button>
            </span>
          ))}
        </div>
      ) : null}
      {picker && mode === 'suppliers' ? (
        <fieldset className="grid grid-cols-4 gap-2 border-b border-line px-4 py-3">
          <legend className="sr-only">{t(locale, 'columnsTitle')}</legend>
          {SUPPLIER_COLUMNS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={columns.includes(id)} onChange={() => setColumns((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
              {t(locale, id as CopyKey)}
            </label>
          ))}
        </fieldset>
      ) : null}
      {filterOpen ? (
        <form
          className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const field = String(form.get('field'));
            const op = String(form.get('op'));
            const value = String(form.get('value'));
            if (field === 'country') setParam('country', `${op}:${value}`);
            if (field === 'reach') setParam('reach', value);
            if (field === 'risk') setParam('risk', value);
            setFilterOpen(false);
          }}
        >
          <label className="text-[12px] text-tertiary">{t(locale, 'filterCountry')}
            <select name="field" className="mt-1 block h-[34px] rounded-[6px] border border-line-strong px-2 text-[13px] text-foreground">
              <option value="country">{t(locale, 'country')}</option>
              <option value="reach">REACH</option>
              <option value="risk">{t(locale, 'risk')}</option>
            </select>
          </label>
          <label className="text-[12px] text-tertiary">{t(locale, 'is')}
            <select name="op" className="mt-1 block h-[34px] rounded-[6px] border border-line-strong px-2 text-[13px] text-foreground">
              <option value="is">{t(locale, 'is')}</option>
              <option value="not">{t(locale, 'isNot')}</option>
            </select>
          </label>
          <label className="text-[12px] text-tertiary">{t(locale, 'filterValue')}
            <input name="value" className="mt-1 block h-[34px] rounded-[6px] border border-line-strong px-2 text-[13px]" placeholder="DE" />
          </label>
          <Button type="submit">{t(locale, 'apply')}</Button>
        </form>
      ) : null}
      <div className="min-h-0 flex-1">
        {mode === 'suppliers' ? (
          <DataGrid rows={suppliers} columns={supplierColumns} visible={columns} locale={locale} caption={t(locale, 'suppliers')} selectable selected={selected} onSelectedChange={setSelected} />
        ) : (
          <DataGrid rows={articles} columns={articleColumns} visible={articleColumns.map((column) => column.id)} locale={locale} caption={t(locale, 'articles')} selectable selected={selected} onSelectedChange={setSelected} pageSize={25} />
        )}
      </div>
    </div>
  );
}

function buildStats(suppliers: Supplier[], articles: Article[], campaigns: { id: string; status: string; recipients: { supplierId: string; state: string; lastResponseAt?: string }[] }[], changes: { state: string; entity: string; entityId: string }[]) {
  const open = new Map<string, number>();
  const last = new Map<string, string>();
  for (const campaign of campaigns) {
    if (campaign.status !== 'open' && campaign.status !== 'in_review') continue;
    for (const recipient of campaign.recipients) {
      open.set(recipient.supplierId, (open.get(recipient.supplierId) ?? 0) + 1);
      if (recipient.lastResponseAt && recipient.lastResponseAt > (last.get(recipient.supplierId) ?? '')) last.set(recipient.supplierId, recipient.lastResponseAt);
    }
  }
  const coverage = new Map<string, { known: number; total: number }>();
  const counts = new Map<string, number>();
  for (const article of articles) {
    const supplierId = article.supplierIds[0] ?? '';
    counts.set(supplierId, (counts.get(supplierId) ?? 0) + 1);
    const bucket = coverage.get(supplierId) ?? { known: 0, total: 0 };
    bucket.total += 1;
    if (currentOf(article.fields.co2eKg).value !== null) bucket.known += 1;
    coverage.set(supplierId, bucket);
  }
  const ranks = new Map([...suppliers].sort((a, b) => b.spend12m - a.spend12m).map((supplier, index) => [supplier.id, index + 1]));
  return { open, last, coverage, counts, ranks, pending: changes };
}

function matchFilter(supplier: Supplier, filter: FilterChip, stats: ReturnType<typeof buildStats>): boolean {
  if (filter.key === 'country' && filter.op === 'is') return supplier.country === filter.value;
  if (filter.key === 'country' && filter.op === 'not') return supplier.country !== filter.value;
  if (filter.key === 'reach') return String(currentOf(supplier.fields.reachStatus).value) === filter.value;
  if (filter.key === 'risk') return supplier.riskScore > Number(filter.value);
  if (filter.key === 'open') return (stats.open.get(supplier.id) ?? 0) > 0;
  return true;
}

interface FilterChip { key: string; op: string; value: string; raw: string; label: (locale: 'en' | 'de') => string }

function readFilters(params: { get: (key: string) => string | null }): FilterChip[] {
  const filters: FilterChip[] = [];
  const country = params.get('country');
  if (country) {
    const [op, value] = country.split(':');
    filters.push({
      key: 'country',
      op: op === 'not' ? 'not' : 'is',
      value: value ?? country,
      raw: country,
      label: (locale) => (op === 'not' ? t(locale, 'countryIsNot', { value: value ?? '' }) : t(locale, 'countryIs', { value: value ?? '' })),
    });
  }
  const reach = params.get('reach');
  if (reach) filters.push({ key: 'reach', op: 'is', value: reach, raw: reach, label: (locale) => t(locale, 'reachIs', { value: displayValue('reachStatus', reach, locale) }) });
  const risk = params.get('risk');
  if (risk) filters.push({ key: 'risk', op: 'above', value: risk, raw: risk, label: (locale) => t(locale, 'riskAbove', { value: risk }) });
  return filters;
}

function sortSupplier(row: Supplier, id: string, stats: ReturnType<typeof buildStats>): string | number {
  if (id === 'name' || id === 'legalName') return row.name;
  if (id === 'country' || id === 'city') return row.country;
  if (id === 'category') return row.topCategory;
  if (id === 'risk' || id === 'rating' || id === 'spend') return id === 'rating' ? row.rating : id === 'risk' ? row.riskScore : row.spend12m;
  if (id === 'openRequests') return stats.open.get(row.id) ?? 0;
  if (id === 'articleCount') return stats.counts.get(row.id) ?? 0;
  if (id === 'rank') return stats.ranks.get(row.id) ?? 0;
  return row.name;
}

function renderSupplierCell(row: Supplier, id: string, locale: 'en' | 'de', stats: ReturnType<typeof buildStats>, maxSpend: number) {
  if (id === 'name' || id === 'legalName') return <Link href={`/suppliers/${row.id}`} className="font-medium text-brand">{id === 'legalName' ? String(currentOf(row.fields.legalName).value) : row.name}</Link>;
  if (id === 'country') {
    const country = countryMeta(row.country, locale);
    return <span>{country.flag} {country.name}</span>;
  }
  if (id === 'category') return row.topCategory;
  if (id === 'risk') {
    const tone = row.riskScore >= 70 ? 'bad' : row.riskScore >= 40 ? 'wait' : 'ready';
    return <span className="inline-flex items-center gap-2"><Pill tone={tone}>{row.riskScore}/100</Pill></span>;
  }
  if (id === 'spend') return <span className="inline-flex items-center gap-2"><SpendBar value={row.spend12m} max={maxSpend} /><span className="tabular">{formatMoney(row.spend12m, locale)}</span></span>;
  if (id === 'trend') {
    const first = row.spendTrend12m[0] || 1;
    const last = row.spendTrend12m.at(-1) ?? first;
    const up = last >= first;
    return <span className={cn('inline-flex items-center gap-1 text-[12px] font-medium', up ? 'text-ready-fg' : 'text-bad-fg')}><Sparkline values={row.spendTrend12m} up={up} />{up ? '+' : ''}{formatPercent((last - first) / first, locale, 1)}</span>;
  }
  if (id === 'rating') return <span aria-label={`${row.rating} / 5`}>{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span>;
  if (id === 'openRequests') return <span className="tabular">{stats.open.get(row.id) ?? 0}</span>;
  if (id === 'lastAnswer') return stats.last.get(row.id) ? formatDate(stats.last.get(row.id) as string, locale) : t(locale, 'notInFile');
  if (id === 'reach' || id === 'rohs' || id === 'lksg') {
    const field = id === 'reach' ? 'reachStatus' : id === 'rohs' ? 'rohsStatus' : 'lksgSelfAssessment';
    const value = String(currentOf(row.fields[field]).value);
    const tone = value === 'declared' || value === 'complete' || value === 'exempt' ? 'ready' : value === 'partial' ? 'wait' : 'bad';
    return <Pill tone={tone}>{displayValue(field, value, locale)}</Pill>;
  }
  if (id === 'paymentTerms') return displayValue('paymentTermsDays', currentOf(row.fields.paymentTermsDays).value, locale);
  if (id === 'city') return row.city;
  if (id === 'vat') return <span className="mono">{String(currentOf(row.fields.vatId).value)}</span>;
  if (id === 'bank') return String(currentOf(row.fields.bankName).value);
  if (id === 'contacts') return row.contactIds.length;
  if (id === 'website') return <a className="text-brand" href={row.website}>{row.website.replace('https://', '')}</a>;
  if (id === 'tags') return row.tags.join(', ') || t(locale, 'notInFile');
  if (id === 'rank') return <span className="tabular">{stats.ranks.get(row.id)}</span>;
  if (id === 'co2eCoverage') {
    const bucket = stats.coverage.get(row.id) ?? { known: 0, total: 0 };
    return <span className="tabular">{bucket.total === 0 ? '0%' : formatPercent(bucket.known / bucket.total, locale)}</span>;
  }
  if (id === 'articleCount') return <span className="tabular">{stats.counts.get(row.id) ?? 0}</span>;
  if (id === 'iban') return <span className="mono">{String(currentOf(row.fields.iban).value)}</span>;
  return null;
}

function downloadCsv(mode: string, rows: { id: string; name?: string; partNo?: string }[], data: { suppliers: Supplier[]; articles: Article[] }) {
  const header = mode === 'suppliers' ? ['id', 'name', 'country', 'category'] : ['id', 'part', 'name', 'supplier'];
  const body = rows.map((row) => {
    if (mode === 'suppliers') {
      const supplier = data.suppliers.find((item) => item.id === row.id);
      return [row.id, supplier?.name ?? '', supplier?.country ?? '', supplier?.topCategory ?? ''];
    }
    const article = data.articles.find((item) => item.id === row.id);
    const supplier = data.suppliers.find((item) => item.id === article?.supplierIds[0]);
    return [row.id, article?.partNo ?? '', article?.name ?? '', supplier?.name ?? ''];
  });
  const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = mode === 'suppliers' ? 'suppliers.csv' : 'articles.csv';
  link.click();
  URL.revokeObjectURL(url);
}
