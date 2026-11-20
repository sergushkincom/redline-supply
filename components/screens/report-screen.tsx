'use client';

import {
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { FormulaReveal } from '@/components/formula';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { coverage, type CoverageRow } from '@/lib/coverage';
import { formatNumber, formatPercent } from '@/lib/format';
import { t, type CopyKey } from '@/lib/i18n';
import { useDemo } from '@/lib/store';
import type { Regulation } from '@/lib/types';
import { cn } from '@/lib/utils';

const REGULATIONS: Regulation[] = ['CBAM', 'REACH', 'RoHS', 'EUDR', 'LkSG'];

const KNOWN_KEY: Record<Regulation, CopyKey> = {
  CBAM: 'co2eKnown',
  REACH: 'reachKnown',
  RoHS: 'rohsKnown',
  EUDR: 'eudrKnown',
  LkSG: 'lksgKnown',
};
const UNKNOWN_KEY: Record<Regulation, CopyKey> = {
  CBAM: 'co2eUnknown',
  REACH: 'reachUnknown',
  RoHS: 'rohsUnknown',
  EUDR: 'eudrUnknown',
  LkSG: 'lksgUnknown',
};

export function ReportScreen({ regulation }: { regulation: Regulation }) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const result = useMemo(() => coverage(data, regulation), [data, regulation]);
  const columns = useMemo<ColumnDef<CoverageRow>[]>(
    () => [
      { accessorKey: 'cnCode', header: t(locale, 'cnCode') },
      { accessorKey: 'partNo', header: t(locale, 'partNo') },
      { accessorKey: 'supplierName', header: t(locale, 'suppliers') },
      { id: 'co2e', accessorFn: (row) => row.co2eKg ?? -1, header: t(locale, 'co2e') },
      { id: 'status', accessorFn: (row) => (row.known ? 1 : 0), header: t(locale, 'status') },
    ],
    [locale],
  );
  const table = useReactTable({
    data: result.rows,
    columns,
    state: { grouping: ['cnCode'], expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
  });
  useEffect(() => setReady(true), []);

  const bars = result.bySupplier.slice(0, 8).map((supplier) => ({
    name: supplier.name.split(' ')[0] ?? supplier.name,
    known: supplier.known,
    unknown: supplier.unknown,
  }));
  const requestHref = `/requests?compose=1&regulation=${regulation}&suppliers=${result.unknownSupplierIds.slice(0, 40).join(',')}`;

  function download() {
    const header = ['part', 'name', 'cn', 'supplier', 'known', 'co2e', 'eu_default'];
    const lines = result.rows.map((row) => [row.partNo, row.name, row.cnCode, row.supplierName, row.known ? 'known' : 'unknown', row.co2eKg ?? '', row.euDefault ?? '']);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${regulation.toLowerCase()}-coverage.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[12px] bg-white shadow-card">
      <nav className="w-[220px] shrink-0 overflow-auto border-r border-line p-3" aria-label={t(locale, 'reports')}>
        <p className="px-2 text-[11px] font-medium tracking-[0.06em] text-tertiary">{t(locale, 'pinned')}</p>
        <Link href="/reports/cbam" className={cn('mt-1 block rounded-[8px] px-2 py-2 text-[13px]', regulation === 'CBAM' ? 'bg-brand-soft text-brand' : 'text-secondary')}>CBAM</Link>
        <p className="mt-4 px-2 text-[11px] font-medium tracking-[0.06em] text-tertiary">{t(locale, 'dashboards')}</p>
        <Link href="/suppliers" className="block rounded-[8px] px-2 py-2 text-[13px] text-secondary">{t(locale, 'suppliers')}</Link>
        <Link href="/articles" className="block rounded-[8px] px-2 py-2 text-[13px] text-secondary">{t(locale, 'articles')}</Link>
        <p className="mt-4 px-2 text-[11px] font-medium tracking-[0.06em] text-tertiary">{t(locale, 'regulationReports')}</p>
        {REGULATIONS.map((item) => (
          <Link key={item} href={`/reports/${item.toLowerCase()}`} className={cn('block rounded-[8px] px-2 py-2 text-[13px]', item === regulation ? 'bg-brand-soft font-medium text-brand' : 'text-secondary')}>{item}</Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="title">{regulation}</h1>
            <p className="mt-1 text-[13px] text-secondary">{t(locale, 'coverage')}</p>
          </div>
          <Button variant="secondary" onClick={download}>{t(locale, 'download')}</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="rounded-[12px] border border-line p-4">
            <Pill tone="ready">{t(locale, KNOWN_KEY[regulation])}</Pill>
            <p className="kpi tabular mt-3">{formatNumber(result.known, locale)}<span className="text-[16px] font-normal text-tertiary"> / {formatNumber(result.total, locale)}</span></p>
            <div className="mt-3"><FormulaReveal locale={locale} formula={result.formula} inputs={result.inputs} /></div>
          </article>
          <article className="rounded-[12px] border border-line p-4">
            <Pill tone="bad">{t(locale, UNKNOWN_KEY[regulation])}</Pill>
            <p className="kpi tabular mt-3">{formatNumber(result.unknown, locale)}<span className="text-[16px] font-normal text-tertiary"> / {formatNumber(result.total, locale)}</span></p>
            <Button asChild className="mt-3">
              <a href={requestHref} data-testid="request-status">{t(locale, 'requestStatus')}</a>
            </Button>
          </article>
        </div>
        {ready ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[12px] border border-line p-3">
              <h2 className="px-2 text-[13px] font-medium">{t(locale, 'coverage')}</h2>
              <PieChart width={320} height={220}>
                <Pie data={[{ name: t(locale, KNOWN_KEY[regulation]), value: result.known }, { name: t(locale, UNKNOWN_KEY[regulation]), value: result.unknown }]} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} isAnimationActive={false}>
                  <Cell fill="#3069E6" />
                  <Cell fill="#EFEFEF" />
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
              <p className="px-2 text-[12px] text-tertiary">{formatPercent(result.ratio, locale)} {t(locale, 'known').toLowerCase()}</p>
            </div>
            <div className="overflow-auto rounded-[12px] border border-line p-3">
              <h2 className="px-2 text-[13px] font-medium">{t(locale, 'bySupplier')}</h2>
              <BarChart width={420} height={220} data={bars}>
                <CartesianGrid stroke="#ECEDEF" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="known" name={t(locale, KNOWN_KEY[regulation])} stackId="a" fill="#3069E6" isAnimationActive={false} />
                <Bar dataKey="unknown" name={t(locale, UNKNOWN_KEY[regulation])} stackId="a" fill="#EFEFEF" isAnimationActive={false} />
              </BarChart>
            </div>
          </div>
        ) : null}
        <h2 className="mt-6 text-[13px] font-medium">{t(locale, 'articleTable')}</h2>
        <p className="text-[12px] text-tertiary">{t(locale, 'groupByCn')}</p>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{t(locale, 'articleTable')}</caption>
          <thead className="text-[12px] text-tertiary">
            <tr>
              <th className="px-2 py-2 font-medium">{t(locale, 'partNo')}</th>
              <th className="px-2 py-2 font-medium">{t(locale, 'suppliers')}</th>
              <th className="px-2 py-2 font-medium">{t(locale, 'co2e')}</th>
              <th className="px-2 py-2 font-medium">{t(locale, 'euDefault')}</th>
              <th className="px-2 py-2 font-medium">{t(locale, 'status')}</th>
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const sample = row.subRows[0]?.original;
                return (
                  <tr key={row.id} className="border-t border-line bg-subtle">
                    <th colSpan={5} scope="colgroup" className="px-2 py-2 text-left text-[13px] font-medium">
                      <button type="button" aria-expanded={row.getIsExpanded()} onClick={row.getToggleExpandedHandler()}>
                        {row.getIsExpanded() ? '▾' : '▸'} {String(row.getValue('cnCode'))} · {sample?.category} ({row.subRows.length})
                      </button>
                    </th>
                  </tr>
                );
              }
              const item = row.original;
              if (!item) return null;
              return (
                <tr key={row.id} className="border-t border-line" style={{ height: 48 }}>
                  <td className="px-2 text-[13px]"><span className="mono">{item.partNo}</span><span className="block text-tertiary">{item.name}</span></td>
                  <td className="px-2 text-[13px]"><Link className="text-brand" href={`/suppliers/${item.supplierId}`}>{item.supplierName}</Link></td>
                  <td className="px-2 text-[13px] tabular">{item.co2eKg === null ? t(locale, 'unknown') : `${formatNumber(item.co2eKg, locale, 2)} kg`}</td>
                  <td className="px-2 text-[13px] tabular">{item.euDefault === null ? '—' : item.euDefault}</td>
                  <td className="px-2"><Pill tone={item.known ? 'ready' : 'bad'}>{item.known ? t(locale, 'known') : t(locale, 'unknown')}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

