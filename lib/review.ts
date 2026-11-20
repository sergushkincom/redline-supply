import { approvalsNeeded, approverCount, articleField, supplierField } from './fields';
import type {
  ActivityEntry,
  ArticleFieldKey,
  Campaign,
  FieldVersion,
  ProposedChange,
  SeedData,
  SupplierFieldKey,
} from './types';

export type BulkMode =
  | 'approve_all'
  | 'reject_all'
  | 'approve_except_prices'
  | 'approve_except_bank'
  | 'reject_prices'
  | 'reject_bank';

export function decide(
  change: ProposedChange,
  userId: string,
  decision: 'approve' | 'reject',
  at: string,
  requiredApprovals: 1 | 2,
  note?: string,
): ProposedChange {
  if (change.state === 'applied') return change;
  const decisions = [
    ...change.decisions.filter((item) => item.userId !== userId),
    { userId, decision, at, ...(note ? { note } : {}) },
  ];
  if (decisions.some((item) => item.decision === 'reject')) {
    return { ...change, decisions, state: 'rejected' };
  }
  const state = approverCount({ decisions }) >= approvalsNeeded(change, requiredApprovals) ? 'approved' : 'to_review';
  return { ...change, decisions, state };
}

export function fieldKey(change: Pick<ProposedChange, 'entity' | 'entityId' | 'field'>): string {
  return `${change.entity}:${change.entityId}:${change.field}`;
}

export function unresolvedConflicts(changes: ProposedChange[]): boolean {
  const groups = new Map<string, ProposedChange[]>();
  for (const change of changes) {
    const key = fieldKey(change);
    const list = groups.get(key) ?? [];
    list.push(change);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const open = list.filter((change) => change.state !== 'rejected' && change.state !== 'applied');
    const applied = list.filter((change) => change.state === 'applied' || change.state === 'approved');
    if (open.length > 1 || applied.length > 1) return true;
  }
  return false;
}

export function canFinish(changes: ProposedChange[], campaign: Pick<Campaign, 'requiredApprovals'>): boolean {
  if (changes.length === 0) return false;
  if (unresolvedConflicts(changes)) return false;
  return changes.every((change) => {
    if (change.state === 'rejected' || change.state === 'applied') return true;
    if (change.state !== 'approved') return false;
    return approverCount(change) >= approvalsNeeded(change, campaign.requiredApprovals);
  });
}

export function decidePicking(
  changes: ProposedChange[],
  chosenId: string,
  userId: string,
  at: string,
  requiredApprovals: 1 | 2,
): ProposedChange[] {
  const chosen = changes.find((change) => change.id === chosenId);
  if (!chosen) return changes;
  return changes.map((change) => {
    if (change.id === chosenId) return decide(change, userId, 'approve', at, requiredApprovals);
    if (
      change.campaignId === chosen.campaignId &&
      fieldKey(change) === fieldKey(chosen) &&
      change.state !== 'applied'
    ) {
      return decide(change, userId, 'reject', at, requiredApprovals, 'Other answer kept');
    }
    return change;
  });
}

function isPrice(change: ProposedChange): boolean {
  return change.field === 'unitPrice';
}

function isBank(change: ProposedChange): boolean {
  return change.field === 'iban' || change.field === 'bankName';
}

export function bulkDecide(
  changes: ProposedChange[],
  mode: BulkMode,
  userId: string,
  at: string,
  requiredApprovals: 1 | 2,
  include: (change: ProposedChange) => boolean,
): ProposedChange[] {
  const counts = new Map<string, number>();
  for (const change of changes) counts.set(fieldKey(change), (counts.get(fieldKey(change)) ?? 0) + 1);

  return changes.map((change) => {
    if (!include(change) || change.state === 'applied') return change;
    const conflict = (counts.get(fieldKey(change)) ?? 0) > 1;
    if (conflict && mode !== 'reject_all') return change;
    if (mode === 'approve_all') return decide(change, userId, 'approve', at, requiredApprovals);
    if (mode === 'reject_all') return decide(change, userId, 'reject', at, requiredApprovals);
    if (mode === 'approve_except_prices') {
      return isPrice(change) ? change : decide(change, userId, 'approve', at, requiredApprovals);
    }
    if (mode === 'approve_except_bank') {
      return isBank(change) ? change : decide(change, userId, 'approve', at, requiredApprovals);
    }
    if (mode === 'reject_prices') {
      return isPrice(change) ? decide(change, userId, 'reject', at, requiredApprovals) : change;
    }
    if (mode === 'reject_bank') {
      return isBank(change) ? decide(change, userId, 'reject', at, requiredApprovals) : change;
    }
    return change;
  });
}

function appendVersion<T>(history: FieldVersion<T>[], version: FieldVersion<T>, at: string): FieldVersion<T>[] {
  if (history.length === 0) return [version];
  const last = history[history.length - 1];
  return [...history.slice(0, -1), { ...last, validTo: at }, version];
}

function supplierIdFor(data: SeedData, change: ProposedChange): string {
  if (change.entity === 'supplier') return change.entityId;
  const campaign = data.campaigns.find((item) => item.id === change.campaignId);
  const recipient = campaign?.recipients.find((item) => item.articleIds.includes(change.entityId));
  if (recipient) return recipient.supplierId;
  const article = data.articles.find((item) => item.id === change.entityId);
  return article?.supplierIds[0] ?? '';
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyApproved(data: SeedData, campaignId: string, at: string): SeedData {
  const campaign = data.campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error('Unknown campaign');
  if (campaign.status === 'closed') return data;
  const related = data.changes.filter((change) => change.campaignId === campaignId);
  if (!canFinish(related, campaign)) throw new Error('Review is not ready to finish');

  const suppliers = new Map(data.suppliers.map((supplier) => [supplier.id, supplier]));
  const articles = new Map(data.articles.map((article) => [article.id, article]));
  const activities: ActivityEntry[] = [];
  let activityIndex = data.activities.length + 1;

  const changes = data.changes.map((change) => {
    if (change.campaignId !== campaignId) return change;
    const supplierId = supplierIdFor(data, change);
    if (change.state === 'rejected') {
      activities.push({
        id: `act_apply_${activityIndex++}`,
        supplierId,
        at,
        kind: 'change_rejected',
        actor: { type: 'user', id: change.decisions.at(-1)?.userId ?? campaign.sentBy },
        title: 'Change rejected',
        body: 'Rejected, supplier notified (draft).',
        link: `/suppliers/${supplierId}?tab=details`,
      });
      return change;
    }
    if (change.state !== 'approved') return change;

    const approvedBy = change.decisions.filter((item) => item.decision === 'approve').map((item) => item.userId);
    const version: FieldVersion = {
      value: change.to,
      source: change.source,
      approvedBy,
      validFrom: at,
    };

    if (change.entity === 'supplier') {
      const supplier = suppliers.get(change.entityId);
      if (!supplier) throw new Error('Missing supplier');
      const field = change.field as SupplierFieldKey;
      const history = supplierField(supplier, field);
      if (!valuesEqual(history[history.length - 1]?.value, change.from)) {
        throw new Error(`Stale value for ${change.id}`);
      }
      suppliers.set(supplier.id, {
        ...supplier,
        fields: { ...supplier.fields, [field]: appendVersion(history, version, at) },
      });
    } else {
      const article = articles.get(change.entityId);
      if (!article) throw new Error('Missing article');
      const field = change.field as ArticleFieldKey;
      const history = articleField(article, field);
      if (!valuesEqual(history[history.length - 1]?.value, change.from)) {
        throw new Error(`Stale value for ${change.id}`);
      }
      articles.set(article.id, {
        ...article,
        fields: { ...article.fields, [field]: appendVersion(history, version, at) },
      });
    }

    activities.push({
      id: `act_apply_${activityIndex++}`,
      supplierId,
      at,
      kind: 'change_applied',
      actor: { type: 'user', id: approvedBy.at(-1) ?? campaign.sentBy },
      title: 'Change applied',
      body: `${change.field} updated after review.`,
      link: `/suppliers/${supplierId}?tab=details`,
    });
    return { ...change, state: 'applied' as const };
  });

  return {
    ...data,
    suppliers: data.suppliers.map((supplier) => suppliers.get(supplier.id) ?? supplier),
    articles: data.articles.map((article) => articles.get(article.id) ?? article),
    changes,
    activities: [...data.activities, ...activities],
    campaigns: data.campaigns.map((item) => (item.id === campaignId ? { ...item, status: 'closed' as const } : item)),
  };
}

export function currentValue(data: SeedData, change: Pick<ProposedChange, 'entity' | 'entityId' | 'field'>): unknown {
  if (change.entity === 'supplier') {
    const supplier = data.suppliers.find((item) => item.id === change.entityId);
    if (!supplier) return undefined;
    return supplierField(supplier, change.field).at(-1)?.value;
  }
  const article = data.articles.find((item) => item.id === change.entityId);
  if (!article) return undefined;
  return articleField(article, change.field).at(-1)?.value;
}

export function finishBlock(
  role: 'buyer' | 'compliance' | 'head',
  campaign: Pick<Campaign, 'requiredApprovals'>,
  changes: ProposedChange[],
): 'ready' | 'incomplete' | 'need-head' {
  if (!canFinish(changes, campaign)) return 'incomplete';
  const needsHead = campaign.requiredApprovals === 2 || changes.some((change) => change.sensitive && change.state !== 'rejected');
  if (needsHead && role !== 'head') return 'need-head';
  return 'ready';
}

export function tally(changes: ProposedChange[]): { approved: number; rejected: number; toReview: number } {
  return {
    approved: changes.filter((change) => change.state === 'approved' || change.state === 'applied').length,
    rejected: changes.filter((change) => change.state === 'rejected').length,
    toReview: changes.filter((change) => change.state === 'to_review').length,
  };
}
