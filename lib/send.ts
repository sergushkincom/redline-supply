import { proposeAnswer, answerSource, extractedSource } from './answers';
import { currentOf, isSensitiveValue } from './fields';
import type { ArticleFieldKey, Campaign, ProposedChange, SeedData, SupplierFieldKey } from './types';

function readCurrent(data: SeedData, entity: 'supplier' | 'article', entityId: string, field: string): unknown {
  if (entity === 'supplier') {
    const supplier = data.suppliers.find((item) => item.id === entityId);
    if (!supplier) return null;
    return currentOf(supplier.fields[field as SupplierFieldKey]).value;
  }
  const article = data.articles.find((item) => item.id === entityId);
  if (!article) return null;
  return currentOf(article.fields[field as ArticleFieldKey]).value;
}

export interface SendInput {
  id: string;
  name: string;
  templateId: string;
  supplierIds: string[];
  requiredApprovals: 1 | 2;
  sentBy: string;
  at: string;
  dueAt: string;
}

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function buildSentCampaign(data: SeedData, input: SendInput): { campaign: Campaign; changes: ProposedChange[] } {
  const template = data.templates.find((item) => item.id === input.templateId);
  if (!template) throw new Error('Unknown template');
  const approverIds =
    input.requiredApprovals === 2
      ? [template.regulation === 'CBAM' || template.regulation === 'REACH' ? 'u_compliance' : 'u_buyer', 'u_head']
      : [input.sentBy];

  const recipients = input.supplierIds.map((supplierId, index) => {
    const supplier = data.suppliers.find((item) => item.id === supplierId);
    const contactId = supplier?.contactIds[0] ?? '';
    const articles = data.articles.filter((article) => article.supplierIds[0] === supplierId);
    const preferred =
      template.regulation === 'CBAM'
        ? articles.filter((article) => currentOf(article.fields.co2eKg).value === null)
        : articles;
    const pool = preferred.length > 0 ? preferred : articles;
    const articleIds = pool.slice(0, 2).map((article) => article.id);
    const slot = index / Math.max(1, input.supplierIds.length);
    const answeredCut = Math.max(1, Math.round(input.supplierIds.length * 0.4)) / input.supplierIds.length;
    const partialCut = answeredCut + (input.supplierIds.length >= 5 ? 0.1 : 0);
    const bouncedCut = partialCut + (input.supplierIds.length >= 8 ? 0.08 : 0);
    let state: Campaign['recipients'][number]['state'] = 'sent';
    if (slot < answeredCut) state = 'answered';
    else if (slot < partialCut) state = 'partial';
    else if (slot < bouncedCut) state = 'bounced';
    else if (slot < bouncedCut + 0.2) state = 'opened';
    return {
      contactId,
      supplierId,
      articleIds,
      state,
      ...(state === 'answered' || state === 'partial' ? { lastResponseAt: input.at } : {}),
    };
  });

  const changes: ProposedChange[] = [];
  let sequence = 1;
  for (const recipient of recipients) {
    if (recipient.state !== 'answered' && recipient.state !== 'partial') continue;
    const questions = recipient.state === 'partial' ? template.questions.slice(0, 1) : template.questions;
    for (const question of questions) {
      const targets =
        question.target.entity === 'supplier'
          ? [recipient.supplierId]
          : recipient.articleIds;
      for (const entityId of targets) {
        const current = readCurrent(data, question.target.entity, entityId, question.target.field);
        const rng = () => hashUnit(`${input.id}:${question.id}:${entityId}`);
        const to = proposeAnswer(question.target.field, current, rng);
        const extracted =
          question.target.field === 'co2eKg' || question.target.field === 'iban' || question.target.field === 'drawingFileId';
        changes.push({
          id: `${input.id}_c${sequence++}`,
          campaignId: input.id,
          entity: question.target.entity,
          entityId,
          field: question.target.field,
          from: current,
          to,
          source: extracted
            ? extractedSource(
                input.id,
                `${question.target.field}.pdf`,
                question.target.field === 'drawingFileId' ? 2 : 1,
                `${question.label}: ${String(to)}`,
                input.at,
              )
            : answerSource(input.id, recipient.contactId, input.at),
          sensitive: question.sensitive || isSensitiveValue(question.target.field, current, to),
          decisions: [],
          state: 'to_review',
        });
      }
    }
  }

  const hasAnswers = recipients.some((recipient) => recipient.state === 'answered' || recipient.state === 'partial');
  const campaign: Campaign = {
    id: input.id,
    name: input.name,
    templateId: input.templateId,
    tags: template.regulation ? [template.regulation] : ['Pricing'],
    sentAt: input.at,
    dueAt: input.dueAt,
    sentBy: input.sentBy,
    approverIds,
    requiredApprovals: input.requiredApprovals,
    recipients,
    status: hasAnswers ? 'in_review' : 'open',
  };
  return { campaign, changes };
}
