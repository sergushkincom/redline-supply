'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isComplianceField } from './fields';
import { buildSentCampaign } from './send';
import { seed } from './seed';
import { applyApproved, bulkDecide, canFinish, decide, decidePicking, fieldKey, finishBlock } from './review';
import type { BulkMode } from './review';
import type { Locale, ProposedChange, Role, SeedData } from './types';

export function userIdFor(role: Role): string {
  if (role === 'compliance') return 'u_compliance';
  if (role === 'head') return 'u_head';
  return 'u_buyer';
}

export function canRoleDecide(role: Role, change: Pick<ProposedChange, 'field'>): boolean {
  if (role === 'compliance') return isComplianceField(change.field);
  return true;
}

interface DemoState {
  seedRev: string;
  role: Role;
  locale: Locale;
  data: SeedData;
  qty: Record<string, number>;
  notice: 'applied' | 'reminded' | 'sent' | 'reset' | null;
  setRole: (role: Role) => void;
  setLocale: (locale: Locale) => void;
  reset: () => void;
  clearNotice: () => void;
  decideChange: (changeId: string, decision: 'approve' | 'reject') => void;
  bulk: (campaignId: string, supplierId: string, mode: BulkMode) => void;
  finish: (campaignId: string) => 'ready' | 'incomplete' | 'need-head';
  sendCampaign: (input: { name: string; templateId: string; supplierIds: string[]; requiredApprovals: 1 | 2 }) => string;
  remind: (campaignId: string) => void;
  closeCampaign: (campaignId: string) => void;
  toggleTask: (taskId: string) => void;
  setQty: (key: string, qty: number) => void;
}

function supplierForChange(data: SeedData, change: ProposedChange): string {
  if (change.entity === 'supplier') return change.entityId;
  const campaign = data.campaigns.find((item) => item.id === change.campaignId);
  const recipient = campaign?.recipients.find((item) => item.articleIds.includes(change.entityId));
  return recipient?.supplierId ?? data.articles.find((article) => article.id === change.entityId)?.supplierIds[0] ?? '';
}

let userTouched = false;

function touch() {
  userTouched = true;
}

export const useDemo = create<DemoState>()(
  persist(
    (set, get) => ({
      seedRev: seed.seedRev,
      role: 'buyer',
      locale: 'en',
      data: seed,
      qty: {},
      notice: null,
      setRole: (role) => {
        touch();
        set({ role });
      },
      setLocale: (locale) => {
        touch();
        set({ locale });
      },
      clearNotice: () => set({ notice: null }),
      reset: () => {
        touch();
        set({ data: seed, role: 'buyer', locale: 'en', qty: {}, notice: 'reset', seedRev: seed.seedRev });
      },
      decideChange: (changeId, decision) => {
        touch();
        const state = get();
        const target = state.data.changes.find((change) => change.id === changeId);
        const campaign = state.data.campaigns.find((item) => item.id === target?.campaignId);
        if (!target || !campaign || target.state === 'applied' || !canRoleDecide(state.role, target)) return;
        const at = new Date().toISOString();
        const userId = userIdFor(state.role);
        const related = state.data.changes.filter((change) => change.campaignId === campaign.id);
        const siblings = related.filter(
          (change) => change.id !== target.id && fieldKey(change) === fieldKey(target) && change.state !== 'applied',
        );
        const nextRelated =
          decision === 'approve' && siblings.some((change) => change.state !== 'rejected')
            ? decidePicking(related, changeId, userId, at, campaign.requiredApprovals)
            : related.map((change) =>
                change.id === changeId ? decide(change, userId, decision, at, campaign.requiredApprovals) : change,
              );
        const byId = new Map(nextRelated.map((change) => [change.id, change]));
        set({
          data: {
            ...state.data,
            changes: state.data.changes.map((change) => byId.get(change.id) ?? change),
          },
        });
      },
      bulk: (campaignId, supplierId, mode) => {
        touch();
        const state = get();
        const campaign = state.data.campaigns.find((item) => item.id === campaignId);
        if (!campaign || campaign.status === 'closed') return;
        const at = new Date().toISOString();
        const userId = userIdFor(state.role);
        const next = bulkDecide(state.data.changes, mode, userId, at, campaign.requiredApprovals, (change) => {
          if (change.campaignId !== campaignId) return false;
          if (supplierForChange(state.data, change) !== supplierId) return false;
          return canRoleDecide(state.role, change);
        });
        set({ data: { ...state.data, changes: next } });
      },
      finish: (campaignId) => {
        touch();
        const state = get();
        const campaign = state.data.campaigns.find((item) => item.id === campaignId);
        if (!campaign) return 'incomplete';
        const related = state.data.changes.filter((change) => change.campaignId === campaignId);
        const block = finishBlock(state.role, campaign, related);
        if (block !== 'ready' || !canFinish(related, campaign)) return block === 'ready' ? 'incomplete' : block;
        set({ data: applyApproved(state.data, campaignId, new Date().toISOString()), notice: 'applied' });
        return 'ready';
      },
      sendCampaign: (input) => {
        touch();
        const state = get();
        const id = `cmp_${Date.now().toString(36)}`;
        const at = new Date().toISOString();
        const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const built = buildSentCampaign(state.data, {
          ...input,
          id,
          sentBy: userIdFor(state.role),
          at,
          dueAt: due,
        });
        const supplierId = input.supplierIds[0] ?? 's01';
        set({
          notice: 'sent',
          data: {
            ...state.data,
            campaigns: [built.campaign, ...state.data.campaigns],
            changes: [...state.data.changes, ...built.changes],
            activities: [
              ...state.data.activities,
              {
                id: `act_${id}`,
                supplierId,
                at,
                kind: 'system',
                actor: { type: 'system', id: 'system' },
                title: 'Matched answers to articles',
                link: `/requests/${id}/responses`,
              },
            ],
          },
        });
        return id;
      },
      remind: (campaignId) => {
        touch();
        const state = get();
        const at = new Date().toISOString();
        set({
          notice: 'reminded',
          data: {
            ...state.data,
            campaigns: state.data.campaigns.map((campaign) =>
              campaign.id === campaignId ? { ...campaign, lastRemindedAt: at } : campaign,
            ),
            activities: [
              ...state.data.activities,
              ...state.data.campaigns
                .find((campaign) => campaign.id === campaignId)
                ?.recipients.filter((recipient) => recipient.state !== 'answered')
                .map((recipient, index) => ({
                  id: `act_remind_${campaignId}_${index}`,
                  supplierId: recipient.supplierId,
                  at,
                  kind: 'email_out' as const,
                  actor: { type: 'user' as const, id: userIdFor(state.role) },
                  title: 'Reminder drafted',
                  body: 'Reminder drafted for an unfinished supplier. Nothing was sent.',
                })) ?? [],
            ],
          },
        });
      },
      closeCampaign: (campaignId) => {
        touch();
        const state = get();
        set({
          data: {
            ...state.data,
            campaigns: state.data.campaigns.map((campaign) =>
              campaign.id === campaignId ? { ...campaign, status: 'closed' } : campaign,
            ),
          },
        });
      },
      toggleTask: (taskId) => {
        touch();
        const state = get();
        set({
          data: {
            ...state.data,
            tasks: state.data.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
          },
        });
      },
      setQty: (key, qty) => {
        touch();
        set({ qty: { ...get().qty, [key]: qty } });
      },
    }),
    {
      name: 'redline-supply',
      skipHydration: true,
      partialize: (state) => ({
        seedRev: state.seedRev,
        role: state.role,
        locale: state.locale,
        data: state.data,
        qty: state.qty,
      }),
      merge: (persisted, current) => {
        if (userTouched) return current;
        const saved = persisted as Partial<DemoState> | undefined;
        if (!saved || saved.seedRev !== seed.seedRev) return current;
        return { ...current, ...saved, notice: null };
      },
    },
  ),
);
