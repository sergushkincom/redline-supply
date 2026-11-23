import { describe, expect, it } from 'vitest';
import { approvalsNeeded } from '@/lib/fields';
import { applyApproved, approvalMeter, bulkDecide, canFinish, decide, decidePicking, unresolvedConflicts } from '@/lib/review';
import type { Campaign, ProposedChange, SeedData } from '@/lib/types';

const at = '2026-11-20T08:00:00.000Z';

function change(partial: Partial<ProposedChange> = {}): ProposedChange {
  return {
    id: partial.id ?? 'chg_1',
    campaignId: 'cmp',
    entity: 'supplier',
    entityId: 's01',
    field: 'legalName',
    from: 'Alt GmbH',
    to: 'Neu GmbH',
    source: { kind: 'supplier_answer', requestId: 'cmp', contactId: 'c001', at },
    sensitive: false,
    decisions: [],
    state: 'to_review',
    ...partial,
  };
}

function campaign(requiredApprovals: 1 | 2 = 1): Campaign {
  return {
    id: 'cmp',
    name: 'Sample',
    templateId: 'tpl_price',
    tags: [],
    sentBy: 'u_buyer',
    approverIds: ['u_buyer', 'u_head'],
    requiredApprovals,
    recipients: [],
    status: 'in_review',
  };
}

describe('decide', () => {
  it('approves a normal field with one person when the campaign asks for one', () => {
    const next = decide(change(), 'u_buyer', 'approve', at, 1);
    expect(next.state).toBe('approved');
    expect(approvalsNeeded(next, 1)).toBe(1);
  });

  it('keeps a sensitive field in review until a second person approves', () => {
    const first = decide(change({ sensitive: true, field: 'iban' }), 'u_buyer', 'approve', at, 1);
    expect(first.state).toBe('to_review');
    const second = decide(first, 'u_head', 'approve', at, 1);
    expect(second.state).toBe('approved');
    expect(new Set(second.decisions.map((item) => item.userId)).size).toBe(2);
  });

  it('does not let the same person count twice', () => {
    const once = decide(change({ sensitive: true }), 'u_buyer', 'approve', at, 2);
    const again = decide(once, 'u_buyer', 'approve', at, 2);
    expect(again.state).toBe('to_review');
    expect(again.decisions).toHaveLength(1);
  });

  it('rejects on a single reject and keeps that if they do not change their mind', () => {
    const rejected = decide(change({ sensitive: true }), 'u_compliance', 'reject', at, 2, 'Does not match the file');
    expect(rejected.state).toBe('rejected');
    const still = decide(rejected, 'u_head', 'approve', at, 2);
    expect(still.state).toBe('rejected');
  });

  it('lets the rejecting person switch to approve', () => {
    const rejected = decide(change(), 'u_buyer', 'reject', at, 1);
    const approved = decide(rejected, 'u_buyer', 'approve', at, 1);
    expect(approved.state).toBe('approved');
  });

  it('requires two people for every field when the campaign says so', () => {
    const first = decide(change(), 'u_buyer', 'approve', at, 2);
    expect(first.state).toBe('to_review');
    expect(canFinish([first], campaign(2))).toBe(false);
    const second = decide(first, 'u_head', 'approve', at, 2);
    expect(canFinish([second], campaign(2))).toBe(true);
  });
});

describe('approvalMeter', () => {
  it('stays hidden until a sensitive field has its first approval', () => {
    expect(approvalMeter(change({ sensitive: true, field: 'iban' }), 1)).toBeNull();
  });

  it('shows one of two after the first approval on a sensitive field', () => {
    const first = decide(change({ sensitive: true, field: 'iban' }), 'u_buyer', 'approve', at, 1);
    expect(approvalMeter(first, 1)).toEqual({ done: 1, need: 2 });
  });

  it('fills both steps once the second person approves', () => {
    const first = decide(change({ sensitive: true, field: 'iban' }), 'u_buyer', 'approve', at, 1);
    const second = decide(first, 'u_head', 'approve', at, 1);
    expect(approvalMeter(second, 1)).toEqual({ done: 2, need: 2 });
  });

  it('does not show a meter for an ordinary field, even when the campaign asks for two people', () => {
    const next = decide(change(), 'u_buyer', 'approve', at, 2);
    expect(next.state).toBe('to_review');
    expect(approvalMeter(next, 2)).toBeNull();
  });

  it('hides the meter when the sensitive row is rejected', () => {
    const rejected = decide(change({ sensitive: true, field: 'iban' }), 'u_buyer', 'reject', at, 1);
    expect(approvalMeter(rejected, 1)).toBeNull();
  });
});

describe('conflicts', () => {
  it('blocks finish while two answers for one field are still open', () => {
    const pair = [
      change({ id: 'a', to: 'declared' }),
      change({ id: 'b', to: 'missing', source: { kind: 'supplier_answer', requestId: 'cmp', contactId: 'c002', at } }),
    ];
    expect(unresolvedConflicts(pair)).toBe(true);
    const picked = decidePicking(pair, 'a', 'u_buyer', at, 1);
    expect(picked.find((item) => item.id === 'a')?.state).toBe('approved');
    expect(picked.find((item) => item.id === 'b')?.state).toBe('rejected');
    expect(canFinish(picked, campaign(1))).toBe(true);
  });

  it('allows rejecting both answers', () => {
    const pair = [change({ id: 'a' }), change({ id: 'b' })].map((item) => decide(item, 'u_buyer', 'reject', at, 1));
    expect(unresolvedConflicts(pair)).toBe(false);
    expect(canFinish(pair, campaign(1))).toBe(true);
  });
});

describe('bulkDecide', () => {
  it('can approve everything except prices', () => {
    const rows = [
      change({ id: 'name', field: 'legalName' }),
      change({ id: 'price', entity: 'article', entityId: 'a0001', field: 'unitPrice', from: 1000, to: 1200 }),
    ];
    const next = bulkDecide(rows, 'approve_except_prices', 'u_buyer', at, 1, () => true);
    expect(next.find((item) => item.id === 'name')?.state).toBe('approved');
    expect(next.find((item) => item.id === 'price')?.state).toBe('to_review');
  });
});

describe('applyApproved', () => {
  function data(changes: ProposedChange[]): SeedData {
    return {
      seedRev: 'test',
      demoNow: at,
      users: [],
      suppliers: [
        {
          id: 's01',
          name: 'Alt GmbH',
          country: 'DE',
          city: 'Hamburg',
          website: 'https://alt.example',
          topCategory: 'Motors',
          riskScore: 20,
          rating: 4,
          spend12m: 1000,
          spendTrend12m: [1],
          contactIds: ['c001'],
          tags: [],
          fields: {
            legalName: [{ value: 'Alt GmbH', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            address: [{ value: 'Werkring 1', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            vatId: [{ value: 'DE000000001', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            iban: [{ value: 'DE00000000000000000001', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            bankName: [{ value: 'Nordhafen Clearing', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            paymentTermsDays: [{ value: 30, source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            reachStatus: [{ value: 'unknown', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            rohsStatus: [{ value: 'unknown', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            lksgSelfAssessment: [{ value: 'missing', source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
          },
        },
      ],
      contacts: [],
      articles: [
        {
          id: 'a0001',
          partNo: 'ALT-1',
          name: 'Servo motor',
          cnCode: '8501',
          category: 'Motors',
          supplierIds: ['s01'],
          unit: 'pcs',
          fields: {
            unitPrice: [{ value: 1000, source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            moq: [{ value: 10, source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            co2eKg: [{ value: null, source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
            drawingFileId: [{ value: null, source: { kind: 'erp_import', at }, approvedBy: [], validFrom: at }],
          },
        },
      ],
      templates: [],
      campaigns: [campaign(1)],
      changes,
      activities: [],
      tasks: [],
      evaluations: [],
      documents: [],
    };
  }

  it('writes a new version and closes the previous one', () => {
    const approved = decide(change(), 'u_buyer', 'approve', at, 1);
    const next = applyApproved(data([approved]), 'cmp', at);
    const history = next.suppliers[0]?.fields.legalName ?? [];
    expect(history).toHaveLength(2);
    expect(history[0]?.validTo).toBe(at);
    expect(history[1]?.value).toBe('Neu GmbH');
    expect(history[1]?.approvedBy).toEqual(['u_buyer']);
    expect(next.changes[0]?.state).toBe('applied');
    expect(next.campaigns[0]?.status).toBe('closed');
    expect(next.activities.some((item) => item.kind === 'change_applied')).toBe(true);
  });

  it('does not change master data when the row is rejected', () => {
    const rejected = decide(change(), 'u_buyer', 'reject', at, 1);
    const next = applyApproved(data([rejected]), 'cmp', at);
    expect(next.suppliers[0]?.fields.legalName).toHaveLength(1);
    expect(next.suppliers[0]?.fields.legalName[0]?.value).toBe('Alt GmbH');
    expect(next.activities.some((item) => item.body?.includes('supplier notified'))).toBe(true);
  });

  it('refuses to finish a partial sensitive approval', () => {
    const partial = decide(change({ field: 'iban', sensitive: true, from: 'DE00000000000000000001', to: 'DE00000000000000000002' }), 'u_buyer', 'approve', at, 1);
    expect(() => applyApproved(data([partial]), 'cmp', at)).toThrow(/not ready/);
  });

  it('applies a sensitive value only after two approvers', () => {
    const first = decide(
      change({ field: 'co2eKg', entity: 'article', entityId: 'a0001', sensitive: true, from: null, to: 2.4 }),
      'u_compliance',
      'approve',
      at,
      2,
    );
    const second = decide(first, 'u_head', 'approve', at, 2);
    const next = applyApproved({ ...data([second]), campaigns: [campaign(2)] }, 'cmp', at);
    expect(next.articles[0]?.fields.co2eKg.at(-1)?.value).toBe(2.4);
    expect(next.articles[0]?.fields.co2eKg.at(-1)?.approvedBy).toEqual(['u_compliance', 'u_head']);
  });
});
