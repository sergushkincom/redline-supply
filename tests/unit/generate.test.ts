import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { currentOf } from '@/lib/fields';
import { recipientStats } from '@/lib/home';
import { generate } from '@/lib/mock/generate';
import { currentValue } from '@/lib/review';

const banned = readFileSync('.github/banned-words.txt', 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

describe('generator', () => {
  const data = generate({ banned });

  it('builds the seeded population', () => {
    expect(data.suppliers).toHaveLength(64);
    expect(data.articles).toHaveLength(1300);
    expect(data.campaigns).toHaveLength(5);
    expect(new Set(data.campaigns.map((campaign) => campaign.status))).toEqual(
      new Set(['draft', 'open', 'in_review', 'closed']),
    );
  });

  it('keeps about 80 percent of spend with the top 20 percent of suppliers', () => {
    const sorted = [...data.suppliers].sort((a, b) => b.spend12m - a.spend12m);
    const total = sorted.reduce((sum, supplier) => sum + supplier.spend12m, 0);
    const top = sorted.slice(0, 13).reduce((sum, supplier) => sum + supplier.spend12m, 0);
    expect(top / total).toBeGreaterThan(0.78);
    expect(top / total).toBeLessThan(0.82);
    expect(sorted.reduce((sum, supplier) => sum + supplier.spendTrend12m.reduce((inner, value) => inner + value, 0), 0)).toBe(
      total,
    );
  });

  it('gives every field an ERP version and a longer history to about 10 percent', () => {
    let fields = 0;
    let longer = 0;
    for (const supplier of data.suppliers) {
      for (const history of Object.values(supplier.fields)) {
        fields += 1;
        expect(history.length).toBeGreaterThan(0);
        expect(history.some((version) => version.source.kind === 'erp_import')).toBe(true);
        if (history.length >= 2) longer += 1;
      }
    }
    for (const article of data.articles) {
      for (const history of Object.values(article.fields)) {
        fields += 1;
        expect(history[0]?.source.kind === 'erp_import' || history.some((version) => version.source.kind === 'erp_import')).toBe(
          true,
        );
        if (history.length >= 2) longer += 1;
      }
    }
    expect(longer / fields).toBeGreaterThan(0.07);
    expect(longer / fields).toBeLessThan(0.14);
  });

  it('matches the open campaign counters', () => {
    const campaign = data.campaigns.find((item) => item.id === 'cmp_reach');
    expect(campaign).toBeTruthy();
    const stats = recipientStats(campaign!);
    expect(stats.recipients).toBe(31);
    expect(stats.responses).toBe(12);
    expect(stats.partial).toBe(3);
    expect(stats.bounced).toBeGreaterThan(0);
  });

  it('keeps proposed values aligned with master data', () => {
    for (const change of data.changes) {
      const current = currentValue(data, change);
      if (change.state === 'applied') {
        expect(current).toEqual(change.to);
        const history =
          change.entity === 'supplier'
            ? data.suppliers.find((supplier) => supplier.id === change.entityId)?.fields[
                change.field as 'legalName'
              ]
            : data.articles.find((article) => article.id === change.entityId)?.fields[change.field as 'unitPrice'];
        expect(history?.at(-2)?.value).toEqual(change.from);
      } else {
        expect(current).toEqual(change.from);
      }
    }
    for (const supplier of data.suppliers) {
      expect(currentOf(supplier.fields.legalName).value).toBeTruthy();
    }
  });

  it('puts the RoHS review and the CBAM review in the queue', () => {
    const rohs = data.changes.filter((change) => change.campaignId === 'cmp_rohs');
    expect(rohs.length).toBeGreaterThan(8);
    expect(rohs.some((change) => change.sensitive)).toBe(true);
    expect(rohs.filter((change) => change.field === 'rohsStatus' && change.entityId === 's02')).toHaveLength(2);
    expect(data.changes.some((change) => change.campaignId === 'cmp_cbam' && change.field === 'co2eKg')).toBe(true);
    expect(data.campaigns.find((campaign) => campaign.id === 'cmp_closed')?.status).toBe('closed');
  });
});
