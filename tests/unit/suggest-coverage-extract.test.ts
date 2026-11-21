import { describe, expect, it } from 'vitest';
import { coverage } from '@/lib/coverage';
import { FIXTURE_TEXT } from '@/lib/extract/fixture';
import { extractHits } from '@/lib/extract';
import { generate } from '@/lib/mock/generate';
import { applyApproved, decide } from '@/lib/review';
import { countForCoverage, suggestRecipients } from '@/lib/suggest';

describe('suggestions', () => {
  it('ranks by spend times risk and reports coverage', () => {
    const suppliers = [
      { id: 'low', spend12m: 100, riskScore: 10 },
      { id: 'high', spend12m: 900, riskScore: 50 },
      { id: 'mid', spend12m: 400, riskScore: 20 },
    ];
    const result = suggestRecipients(suppliers, 2);
    expect(result.picked.map((item) => item.id)).toEqual(['high', 'mid']);
    expect(result.coverage).toBeCloseTo(1300 / 1400, 5);
    expect(result.formula).toContain('spend_12m');
    expect(countForCoverage(suppliers, 0.9)).toBe(2);
  });
});

describe('extraction', () => {
  it('maps the sample reply onto fields with a page and a snippet', () => {
    const hits = extractHits(FIXTURE_TEXT);
    const price = hits.find((hit) => hit.field === 'unitPrice');
    const iban = hits.find((hit) => hit.field === 'iban');
    const file = hits.find((hit) => hit.field === 'drawingFileId');
    expect(price).toMatchObject({ value: 12350, page: 2 });
    expect(price?.snippet).toContain('Unit price');
    expect(iban).toMatchObject({ entity: 'supplier', page: 1 });
    expect(file?.value).toBe('drawing-24423.pdf');
  });
});

describe('coverage loop', () => {
  const seed = generate();

  it('starts near 56 percent known emissions', () => {
    const result = coverage(seed, 'CBAM');
    expect(result.total).toBe(1300);
    expect(result.known).toBe(728);
    expect(result.formula).toContain('CO₂e');
  });

  it('raises the known count after the CBAM review is approved', () => {
    const before = coverage(seed, 'CBAM').known;
    const campaign = seed.campaigns.find((item) => item.id === 'cmp_cbam');
    expect(campaign).toBeTruthy();
    const changes = seed.changes.map((change) => {
      if (change.campaignId !== 'cmp_cbam') return change;
      return decide(decide(change, 'u_compliance', 'approve', seed.demoNow, 2), 'u_head', 'approve', seed.demoNow, 2);
    });
    const applied = applyApproved({ ...seed, changes }, 'cmp_cbam', seed.demoNow);
    const after = coverage(applied, 'CBAM').known;
    expect(after).toBeGreaterThan(before);
    const sample = applied.changes.find((change) => change.campaignId === 'cmp_cbam' && change.state === 'applied');
    expect(sample?.decisions.map((item) => item.userId)).toEqual(['u_compliance', 'u_head']);
  });
});
