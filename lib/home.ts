import { coverage } from './coverage';
import { approvalsNeeded, approverCount, isComplianceField } from './fields';
import { canFinish } from './review';
import type { Campaign, ProposedChange, Regulation, Role, SeedData, SupplierDocument } from './types';

export function recipientStats(campaign: Campaign) {
  const counts = { sent: 0, opened: 0, partial: 0, answered: 0, bounced: 0 };
  for (const recipient of campaign.recipients) counts[recipient.state] += 1;
  return {
    ...counts,
    recipients: campaign.recipients.length,
    responses: counts.answered,
    unfinished: campaign.recipients.length - counts.answered,
  };
}

export function changesFor(data: SeedData, campaignId: string): ProposedChange[] {
  return data.changes.filter((change) => change.campaignId === campaignId);
}

export function changesNeeding(role: Role, changes: ProposedChange[], requiredApprovals: 1 | 2): ProposedChange[] {
  return changes.filter((change) => {
    if (change.state === 'rejected' || change.state === 'applied' || change.state === 'approved') return false;
    const have = approverCount(change);
    const need = approvalsNeeded(change, requiredApprovals);
    if (have >= need) return false;
    if (role === 'head') return need >= 2 && have >= 1;
    if (role === 'compliance') return have === 0 && isComplianceField(change.field);
    return have === 0;
  });
}

export interface ReviewQueueItem {
  campaignId: string;
  name: string;
  dueAt?: string;
  pending: number;
  readyToFinish: boolean;
}

export function reviewQueue(data: SeedData, role: Role): ReviewQueueItem[] {
  return data.campaigns
    .filter((campaign) => campaign.status === 'in_review')
    .map((campaign) => {
      const changes = changesFor(data, campaign.id);
      const pending = changesNeeding(role, changes, campaign.requiredApprovals).length;
      const readyToFinish = canFinish(changes, campaign);
      return {
        campaignId: campaign.id,
        name: campaign.name,
        dueAt: campaign.dueAt,
        pending,
        readyToFinish,
      };
    })
    .filter((item) => (role === 'head' ? item.pending > 0 || item.readyToFinish : item.pending > 0))
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
}

export function overdueCampaigns(data: SeedData): Campaign[] {
  const limit = new Date(data.demoNow).getTime() - 14 * 24 * 60 * 60 * 1000;
  return data.campaigns.filter((campaign) => {
    if (campaign.status !== 'open' || !campaign.sentAt) return false;
    return new Date(campaign.sentAt).getTime() < limit && recipientStats(campaign).unfinished > 0;
  });
}

export function expiringDocuments(data: SeedData): SupplierDocument[] {
  const start = new Date(data.demoNow).getTime();
  const end = start + 30 * 24 * 60 * 60 * 1000;
  return data.documents
    .filter((document) => {
      if (!document.expiresAt) return false;
      const time = new Date(document.expiresAt).getTime();
      return time >= start && time <= end;
    })
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
}

export function expiredDocuments(data: SeedData, supplierId?: string): SupplierDocument[] {
  const now = new Date(data.demoNow).getTime();
  return data.documents.filter((document) => {
    if (supplierId && document.supplierId !== supplierId) return false;
    if (!document.expiresAt) return false;
    return new Date(document.expiresAt).getTime() < now;
  });
}

export interface GapItem {
  regulation: Regulation;
  unknown: number;
  total: number;
  ratio: number;
}

export function reportGaps(data: SeedData): GapItem[] {
  const regulations: Regulation[] = ['CBAM', 'REACH', 'RoHS', 'EUDR', 'LkSG'];
  return regulations
    .map((regulation) => {
      const result = coverage(data, regulation);
      return { regulation, unknown: result.unknown, total: result.total, ratio: result.unknown / result.total };
    })
    .filter((item) => item.ratio > 0.2)
    .sort((a, b) => b.ratio - a.ratio);
}

export function doneToday(data: SeedData) {
  const day = data.demoNow.slice(0, 10);
  const seen = new Set<string>();
  return data.activities.filter((activity) => {
    if (activity.kind !== 'system' || !activity.at.startsWith(day)) return false;
    if (seen.has(activity.title)) return false;
    seen.add(activity.title);
    return true;
  });
}
