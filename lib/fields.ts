import type { Article, ArticleFieldKey, FieldVersion, ProposedChange, Supplier, SupplierFieldKey } from './types';

export const PRICE_THRESHOLD_CENTS = 50_000;

export const SUPPLIER_FIELD_KEYS: SupplierFieldKey[] = [
  'legalName',
  'address',
  'vatId',
  'iban',
  'bankName',
  'paymentTermsDays',
  'reachStatus',
  'rohsStatus',
  'lksgSelfAssessment',
];

export const ARTICLE_FIELD_KEYS: ArticleFieldKey[] = ['unitPrice', 'moq', 'co2eKg', 'drawingFileId'];

export const COMPLIANCE_FIELDS = new Set([
  'reachStatus',
  'rohsStatus',
  'lksgSelfAssessment',
  'co2eKg',
]);

export function currentOf<T>(history: FieldVersion<T>[]): FieldVersion<T> {
  const last = history[history.length - 1];
  if (!last) throw new Error('Field history is empty');
  return last;
}

export function isComplianceField(field: string): boolean {
  return COMPLIANCE_FIELDS.has(field);
}

export function isSensitiveValue(field: string, from: unknown, to: unknown): boolean {
  if (field === 'iban' || field === 'bankName') return true;
  if (field === 'reachStatus' || field === 'rohsStatus' || field === 'lksgSelfAssessment') return true;
  if (field === 'co2eKg') return true;
  if (field === 'unitPrice') {
    const values = [from, to].filter((value): value is number => typeof value === 'number');
    return values.some((value) => value >= PRICE_THRESHOLD_CENTS);
  }
  return false;
}

export function supplierField(supplier: Supplier, field: string): FieldVersion[] {
  return supplier.fields[field as SupplierFieldKey] ?? [];
}

export function articleField(article: Article, field: string): FieldVersion[] {
  return article.fields[field as ArticleFieldKey] ?? [];
}

export function approverCount(change: Pick<ProposedChange, 'decisions'>): number {
  return new Set(change.decisions.filter((item) => item.decision === 'approve').map((item) => item.userId)).size;
}

export function approvalsNeeded(change: Pick<ProposedChange, 'sensitive'>, requiredApprovals: 1 | 2): number {
  return change.sensitive ? Math.max(2, requiredApprovals) : requiredApprovals;
}
