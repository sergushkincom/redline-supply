'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataGrid, type GridColumn } from '@/components/data-grid';
import { Button } from '@/components/ui/button';
import { Pill, type PillTone } from '@/components/ui/pill';
import { Sheet } from '@/components/ui/sheet';
import { coverage } from '@/lib/coverage';
import { formatDate } from '@/lib/format';
import { recipientStats } from '@/lib/home';
import { t } from '@/lib/i18n';
import { formatPercent } from '@/lib/format';
import { countForCoverage, suggestRecipients } from '@/lib/suggest';
import { useDemo } from '@/lib/store';
import type { Campaign, Regulation } from '@/lib/types';

const REGULATIONS = ['CBAM', 'REACH', 'RoHS', 'EUDR', 'LkSG'] as const;

export function RequestsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const role = useDemo((state) => state.role);
  const sendCampaign = useDemo((state) => state.sendCampaign);
  const compose = params.get('compose') === '1';
  const [open, setOpen] = useState(compose);
  useEffect(() => {
    if (compose) setOpen(true);
  }, [compose]);
  const presetSuppliers = (params.get('suppliers') ?? '').split(',').filter(Boolean);
  const regulation = (params.get('regulation') ?? '').toUpperCase();

  const columns: GridColumn<Campaign>[] = [
    { id: 'name', header: t(locale, 'campaignName'), sortValue: (row) => row.name, cell: (row) => <Link className="font-medium text-brand" href={`/requests/${row.id}`}>{row.name}</Link> },
    { id: 'tags', header: t(locale, 'tags'), sortValue: (row) => row.tags.join(','), cell: (row) => row.tags.join(', ') },
    { id: 'status', header: t(locale, 'status'), sortValue: (row) => row.status, cell: (row) => <Pill tone={statusTone(row.status)}>{t(locale, row.status === 'in_review' ? 'inReview' : row.status)}</Pill> },
    { id: 'sent', header: t(locale, 'sentOn'), sortValue: (row) => row.sentAt ?? '', cell: (row) => (row.sentAt ? formatDate(row.sentAt, locale) : t(locale, 'draft')) },
    { id: 'recipients', header: t(locale, 'recipients'), sortValue: (row) => row.recipients.length, cell: (row) => <span className="tabular">{recipientStats(row).recipients}</span> },
    { id: 'responses', header: t(locale, 'responses'), sortValue: (row) => recipientStats(row).responses, cell: (row) => <span className="tabular">{recipientStats(row).responses}</span> },
    { id: 'unfinished', header: t(locale, 'unfinished'), sortValue: (row) => recipientStats(row).unfinished, cell: (row) => <span className="tabular">{recipientStats(row).unfinished}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] bg-white shadow-card">
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="title">{t(locale, 'requests')}</h1>
        <Button onClick={() => setOpen(true)}>{t(locale, 'create')}</Button>
      </div>
      {data.campaigns.length === 0 ? <p className="px-5 text-[13px] text-tertiary">{t(locale, 'emptyCampaigns')}</p> : null}
      <div className="min-h-0 flex-1">
        <DataGrid rows={[...data.campaigns].sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))} columns={columns} visible={columns.map((column) => column.id)} locale={locale} caption={t(locale, 'requests')} />
      </div>
      <CreateSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && compose) {
            const nextParams = new URLSearchParams(params.toString());
            nextParams.delete('compose');
            const query = nextParams.toString();
            router.replace(query ? `/requests?${query}` : '/requests');
          }
        }}
        presetSuppliers={presetSuppliers}
        regulation={REGULATIONS.includes(regulation as Regulation) ? (regulation as Regulation) : undefined}
        onSend={(input) => {
          const id = sendCampaign(input);
          setOpen(false);
          router.push(`/requests/${id}`);
        }}
        role={role}
      />
    </div>
  );
}

function statusTone(status: Campaign['status']): PillTone {
  if (status === 'closed') return 'ready';
  if (status === 'in_review') return 'wait';
  if (status === 'draft') return 'neutral';
  return 'brand';
}

function CreateSheet({
  open,
  onOpenChange,
  presetSuppliers,
  regulation,
  onSend,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetSuppliers: string[];
  regulation?: Regulation;
  onSend: (input: { name: string; templateId: string; supplierIds: string[]; requiredApprovals: 1 | 2 }) => void;
  role: 'buyer' | 'compliance' | 'head';
}) {
  const data = useDemo((state) => state.data);
  const locale = useDemo((state) => state.locale);
  const templateDefault = data.templates.find((item) => item.regulation === regulation)?.id ?? data.templates[0]?.id ?? '';
  const [templateId, setTemplateId] = useState(templateDefault);
  const template = data.templates.find((item) => item.id === templateId) ?? data.templates[0];
  const pool = useMemo(() => {
    if (presetSuppliers.length > 0) return data.suppliers.filter((supplier) => presetSuppliers.includes(supplier.id));
    if (template?.regulation && REGULATIONS.includes(template.regulation)) {
      const unknown = new Set(coverage(data, template.regulation).unknownSupplierIds);
      const subset = data.suppliers.filter((supplier) => unknown.has(supplier.id));
      if (subset.length > 0) return subset;
    }
    return data.suppliers;
  }, [data, presetSuppliers, template]);
  const initialCount = Math.min(pool.length, Math.max(1, countForCoverage(pool, 0.9)));
  const [count, setCount] = useState(initialCount);
  const [checked, setChecked] = useState<string[]>(() => suggestRecipients(pool, initialCount).picked.map((supplier) => supplier.id));
  const [name, setName] = useState(template ? `${template.name}` : '');
  const [required, setRequired] = useState<1 | 2>(template?.regulation ? 2 : 1);
  const suggestion = suggestRecipients(pool, count);
  const selected = pool.filter((supplier) => checked.includes(supplier.id));
  const selectedSpend = selected.reduce((sum, supplier) => sum + supplier.spend12m, 0);
  const totalSpend = pool.reduce((sum, supplier) => sum + supplier.spend12m, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t(locale, 'createTitle')} description={t(locale, 'createBody')} locale={locale}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!template || checked.length === 0) return;
          onSend({ name: name || template.name, templateId: template.id, supplierIds: checked, requiredApprovals: required });
        }}
      >
        <label className="text-[12px] text-tertiary">
          {t(locale, 'campaignName')}
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-[34px] w-full rounded-[6px] border border-line-strong px-2 text-[13px] text-foreground" />
        </label>
        <label className="text-[12px] text-tertiary">
          {t(locale, 'form')}
          <select
            value={template?.id}
            onChange={(event) => {
              setTemplateId(event.target.value);
              const next = data.templates.find((item) => item.id === event.target.value);
              setName(next?.name ?? '');
              setRequired(next?.regulation ? 2 : 1);
            }}
            className="mt-1 h-[34px] w-full rounded-[6px] border border-line-strong px-2 text-[13px] text-foreground"
          >
            {data.templates.map((item) => (
              <option key={item.id} value={item.id}>{item.name} {item.version}</option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-tertiary">{presetSuppliers.length > 0 ? t(locale, 'selectedSuppliers') : template?.regulation ? t(locale, 'gapSuppliers') : t(locale, 'allSuppliers')}</p>
        <label className="text-[13px]">
          <input
            type="range"
            min={1}
            max={Math.max(1, pool.length)}
            value={Math.min(count, Math.max(1, pool.length))}
            onChange={(event) => {
              const next = Number(event.target.value);
              setCount(next);
              setChecked(suggestRecipients(pool, next).picked.map((supplier) => supplier.id));
            }}
          />
        </label>
        <p className="text-[13px] font-medium">
          {t(locale, 'askLine', { n: checked.length, total: pool.length, pct: formatPercent(totalSpend === 0 ? 0 : selectedSpend / totalSpend, locale) })}
        </p>
        <p className="mono text-[11px] text-tertiary">{suggestion.formula}</p>
        <ul className="max-h-48 overflow-auto rounded-[8px] border border-line">
          {suggestion.ranked.slice(0, 40).map((supplier) => (
            <li key={supplier.id} className="flex items-center gap-2 border-b border-line px-2 py-2 text-[13px]">
              <input
                type="checkbox"
                checked={checked.includes(supplier.id)}
                aria-label={supplier.name}
                onChange={() => setChecked((current) => current.includes(supplier.id) ? current.filter((id) => id !== supplier.id) : [...current, supplier.id])}
              />
              <span className="min-w-0 flex-1 truncate">{supplier.name}</span>
            </li>
          ))}
        </ul>
        <fieldset>
          <legend className="text-[12px] text-tertiary">{t(locale, 'approvalsCount')}</legend>
          <label className="mt-1 flex items-center gap-2 text-[13px]"><input type="radio" name="approvals" checked={required === 1} onChange={() => setRequired(1)} />{t(locale, 'oneApprover')}</label>
          <label className="mt-1 flex items-center gap-2 text-[13px]"><input type="radio" name="approvals" checked={required === 2} onChange={() => setRequired(2)} />{t(locale, 'twoApprovers')}</label>
        </fieldset>
        <div>
          <h3 className="text-[12px] font-medium text-tertiary">{t(locale, 'preview')}</h3>
          <ol className="mt-2 list-decimal pl-4 text-[13px]">
            {template?.questions.map((question) => <li key={question.id}>{question.label}{question.sensitive ? ` · ${t(locale, 'sensitiveNote')}` : ''}</li>)}
          </ol>
        </div>
        <p className="text-[12px] leading-4 text-tertiary">{t(locale, 'demoAnswers')}</p>
        <Button type="submit" disabled={checked.length === 0 || role === 'head'}>{t(locale, 'send')}</Button>
      </form>
    </Sheet>
  );
}
