export type Id = string;
export type Cents = number;
export type Iso = string;

export type Source =
  | { kind: 'erp_import'; at: Iso }
  | { kind: 'supplier_answer'; requestId: Id; contactId: Id; at: Iso }
  | { kind: 'extracted'; requestId: Id; fileId: Id; page: number; snippet: string; at: Iso }
  | { kind: 'buyer_edit'; userId: Id; at: Iso }
  | { kind: 'system_default'; rule: string; at: Iso };

export interface FieldVersion<T = unknown> {
  value: T;
  source: Source;
  approvedBy: Id[];
  validFrom: Iso;
  validTo?: Iso;
}

export type SupplierFieldKey =
  | 'legalName'
  | 'address'
  | 'vatId'
  | 'iban'
  | 'bankName'
  | 'paymentTermsDays'
  | 'reachStatus'
  | 'rohsStatus'
  | 'lksgSelfAssessment';

export type ArticleFieldKey = 'unitPrice' | 'moq' | 'co2eKg' | 'drawingFileId';

export type DeclarationStatus = 'declared' | 'missing' | 'exempt' | 'unknown';
export type LksgStatus = 'complete' | 'partial' | 'missing';

export interface Supplier {
  id: Id;
  name: string;
  country: string;
  city: string;
  website: string;
  topCategory: string;
  riskScore: number;
  rating: 1 | 2 | 3 | 4 | 5;
  spend12m: Cents;
  spendTrend12m: number[];
  fields: Record<SupplierFieldKey, FieldVersion[]>;
  contactIds: Id[];
  tags: string[];
}

export interface Contact {
  id: Id;
  supplierId: Id;
  name: string;
  email: string;
  role: string;
}

export interface Article {
  id: Id;
  partNo: string;
  name: string;
  cnCode: string;
  category: string;
  supplierIds: Id[];
  unit: 'pcs' | 'kg' | 'm';
  fields: Record<ArticleFieldKey, FieldVersion[]>;
}

export type Regulation = 'REACH' | 'RoHS' | 'CBAM' | 'EUDR' | 'LkSG';

export interface Question {
  id: Id;
  label: string;
  target: { entity: 'supplier' | 'article'; field: string };
  type: 'boolean' | 'money' | 'integer' | 'text' | 'file' | 'select';
  sensitive: boolean;
}

export interface FormTemplate {
  id: Id;
  name: string;
  version: string;
  regulation?: Regulation;
  questions: Question[];
}

export interface Recipient {
  contactId: Id;
  supplierId: Id;
  articleIds: Id[];
  state: 'sent' | 'opened' | 'partial' | 'answered' | 'bounced';
  lastResponseAt?: Iso;
}

export interface Campaign {
  id: Id;
  name: string;
  templateId: Id;
  tags: string[];
  sentAt?: Iso;
  dueAt?: Iso;
  lastRemindedAt?: Iso;
  sentBy: Id;
  approverIds: Id[];
  requiredApprovals: 1 | 2;
  recipients: Recipient[];
  status: 'draft' | 'open' | 'in_review' | 'closed';
}

export interface Decision {
  userId: Id;
  decision: 'approve' | 'reject';
  at: Iso;
  note?: string;
}

export interface ProposedChange {
  id: Id;
  campaignId: Id;
  entity: 'supplier' | 'article';
  entityId: Id;
  field: string;
  from: unknown;
  to: unknown;
  source: Source;
  sensitive: boolean;
  decisions: Decision[];
  state: 'to_review' | 'approved' | 'rejected' | 'applied';
}

export interface ActivityEntry {
  id: Id;
  supplierId: Id;
  at: Iso;
  kind:
    | 'email_in'
    | 'email_out'
    | 'request_reply'
    | 'evaluation'
    | 'change_applied'
    | 'change_rejected'
    | 'system';
  actor: { type: 'user' | 'supplier' | 'system'; id: Id };
  title: string;
  body?: string;
  link?: string;
}

export interface Task {
  id: Id;
  title: string;
  group: string;
  done: boolean;
  supplierId?: Id;
  due?: Iso;
}

export interface Evaluation {
  id: Id;
  supplierId: Id;
  name: string;
  score: number;
  at: Iso;
}

export interface SupplierDocument {
  id: Id;
  supplierId: Id;
  name: string;
  kind: string;
  expiresAt?: Iso;
  fileId: string;
}

export interface User {
  id: Id;
  name: string;
  role: 'buyer' | 'compliance' | 'head';
}

export interface SeedData {
  seedRev: string;
  demoNow: Iso;
  users: User[];
  suppliers: Supplier[];
  contacts: Contact[];
  articles: Article[];
  templates: FormTemplate[];
  campaigns: Campaign[];
  changes: ProposedChange[];
  activities: ActivityEntry[];
  tasks: Task[];
  evaluations: Evaluation[];
  documents: SupplierDocument[];
}

export type Role = User['role'];
export type Locale = 'en' | 'de';
