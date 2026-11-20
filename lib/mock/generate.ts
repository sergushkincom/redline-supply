import seedrandom from 'seedrandom';
import { proposeAnswer, answerSource, extractedSource } from '../answers';
import { currentOf, isSensitiveValue, SUPPLIER_FIELD_KEYS } from '../fields';
import { applyApproved, decide } from '../review';
import type {
  ActivityEntry,
  Article,
  Campaign,
  Contact,
  Evaluation,
  FieldVersion,
  FormTemplate,
  ProposedChange,
  Recipient,
  SeedData,
  Source,
  Supplier,
  SupplierDocument,
  Task,
} from '../types';
import {
  CATEGORIES,
  CN_GROUPS,
  CONTACT_ROLES,
  COUNTRIES,
  COUNTRY_PLAN,
  FIRST_NAMES,
  LAST_NAMES,
  NAME_A,
  NAME_B,
  NAME_C,
  PART_NOUNS,
  STREETS,
  countryName,
  suffixFor,
} from './catalog';

export const DEMO_NOW = '2026-11-20T08:00:00.000Z';
export const SEED_REV = '2026-11-20.1';
const TOTAL_SPEND = 4_800_000_000;
const PARETO_ALPHA = 1.28;
const ARTICLE_COUNT = 1300;
const KNOWN_CO2E = 728;

type Rng = () => number;

function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const current = next[index] as T;
    next[index] = next[swap] as T;
    next[swap] = current;
  }
  return next;
}

function isoShift(days: number): string {
  const date = new Date(DEMO_NOW);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function erp(at: string): Source {
  return { kind: 'erp_import', at };
}

function version<T>(value: T, at: string, source: Source = erp(at), approvedBy: string[] = []): FieldVersion<T> {
  return { value, source, approvedBy, validFrom: at };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function companyName(rng: Rng, country: string, used: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const stem = `${pick(rng, NAME_A)}${pick(rng, NAME_B)}`;
    const extra = rng() < 0.55 ? ` ${pick(rng, NAME_C)}` : '';
    const name = `${stem}${extra} ${suffixFor(country, rng)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const name = `Haus ${used.size + 1} GmbH`;
  used.add(name);
  return name;
}

function person(rng: Rng, used: Set<string>): { name: string; emailLocal: string } {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    if (used.has(name)) continue;
    used.add(name);
    const [first, last] = name.split(' ');
    return { name, emailLocal: `${first}.${last}`.toLowerCase() };
  }
  const name = `Contact ${used.size + 1}`;
  used.add(name);
  return { name, emailLocal: `contact.${used.size}` };
}

function trend(rng: Rng, spend: number): number[] {
  const drift = rng() < 0.55 ? 0.012 : -0.01;
  const raw = Array.from({ length: 12 }, (_, month) => Math.max(0.35, 1 + (rng() - 0.5) * 0.35 + (month - 5.5) * drift));
  const rawSum = raw.reduce((sum, value) => sum + value, 0);
  const values = raw.map((value) => Math.max(1, Math.round((spend * value) / rawSum)));
  values[11] = Math.max(1, (values[11] ?? 1) + (spend - values.reduce((sum, value) => sum + value, 0)));
  return values;
}

function ratingFor(rng: Rng, risk: number): 1 | 2 | 3 | 4 | 5 {
  if (risk >= 80) return pick(rng, [1, 2, 2, 3] as const);
  if (risk >= 60) return pick(rng, [2, 3, 3, 4] as const);
  if (risk >= 40) return pick(rng, [3, 3, 4, 4, 5] as const);
  return pick(rng, [4, 4, 5, 5] as const);
}

function declaration(rng: Rng): 'declared' | 'missing' | 'exempt' | 'unknown' {
  const roll = rng();
  if (roll < 0.46) return 'declared';
  if (roll < 0.62) return 'exempt';
  if (roll < 0.84) return 'unknown';
  return 'missing';
}

function lksg(rng: Rng): 'complete' | 'partial' | 'missing' {
  const roll = rng();
  if (roll < 0.4) return 'complete';
  if (roll < 0.7) return 'partial';
  return 'missing';
}

function maybeExtend<T>(rng: Rng, history: FieldVersion<T>[], nextValue: (current: T) => T, requestId: string): FieldVersion<T>[] {
  if (rng() >= 0.1) return history;
  const extras = int(rng, 1, 3);
  const copy = [...history];
  for (let index = 0; index < extras; index += 1) {
    const last = copy[copy.length - 1];
    if (!last) break;
    const at = isoShift(-280 + index * 70);
    const source: Source =
      rng() < 0.5
        ? { kind: 'buyer_edit', userId: 'u_buyer', at }
        : { kind: 'supplier_answer', requestId, contactId: 'cnt_archive', at };
    copy.push({
      value: nextValue(last.value),
      source,
      approvedBy: source.kind === 'buyer_edit' ? ['u_buyer'] : ['u_buyer', 'u_head'],
      validFrom: at,
    });
  }
  copy.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return copy.map((item, index) => ({
    ...item,
    validTo: index === copy.length - 1 ? undefined : copy[index + 1]?.validFrom,
  }));
}

function setLast<T>(history: FieldVersion<T>[], value: T): FieldVersion<T>[] {
  const last = history[history.length - 1];
  if (!last) return history;
  return [...history.slice(0, -1), { ...last, value }];
}

function assertClean(value: unknown, banned: string[], path: string): void {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const term of banned) {
      if (lower.includes(term.toLowerCase())) throw new Error(`Banned term "${term}" at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertClean(item, banned, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertClean(item, banned, `${path}.${key}`);
  }
}

function templates(): FormTemplate[] {
  return [
    {
      id: 'tpl_reach',
      name: 'REACH declaration',
      version: 'v21',
      regulation: 'REACH',
      questions: [
        { id: 'q_reach', label: 'REACH status', target: { entity: 'supplier', field: 'reachStatus' }, type: 'select', sensitive: true },
        { id: 'q_price', label: 'Unit price', target: { entity: 'article', field: 'unitPrice' }, type: 'money', sensitive: false },
        { id: 'q_moq', label: 'Minimum order', target: { entity: 'article', field: 'moq' }, type: 'integer', sensitive: false },
      ],
    },
    {
      id: 'tpl_rohs',
      name: 'RoHS form',
      version: 'v3',
      regulation: 'RoHS',
      questions: [
        { id: 'q_rohs', label: 'RoHS status', target: { entity: 'supplier', field: 'rohsStatus' }, type: 'select', sensitive: true },
        { id: 'q_legal', label: 'Legal name', target: { entity: 'supplier', field: 'legalName' }, type: 'text', sensitive: false },
        { id: 'q_terms', label: 'Payment terms', target: { entity: 'supplier', field: 'paymentTermsDays' }, type: 'integer', sensitive: false },
        { id: 'q_iban', label: 'IBAN', target: { entity: 'supplier', field: 'iban' }, type: 'text', sensitive: true },
        { id: 'q_rohs_price', label: 'Unit price', target: { entity: 'article', field: 'unitPrice' }, type: 'money', sensitive: false },
        { id: 'q_drawing', label: 'Technical drawing', target: { entity: 'article', field: 'drawingFileId' }, type: 'file', sensitive: false },
      ],
    },
    {
      id: 'tpl_cbam',
      name: 'CBAM emissions',
      version: 'v2',
      regulation: 'CBAM',
      questions: [
        { id: 'q_co2', label: 'Emissions per unit', target: { entity: 'article', field: 'co2eKg' }, type: 'integer', sensitive: true },
      ],
    },
    {
      id: 'tpl_price',
      name: 'Price update',
      version: 'v4',
      questions: [
        { id: 'q_price_only', label: 'Unit price', target: { entity: 'article', field: 'unitPrice' }, type: 'money', sensitive: false },
      ],
    },
    {
      id: 'tpl_bank',
      name: 'Bank details',
      version: 'v1',
      questions: [
        { id: 'q_bank', label: 'Bank name', target: { entity: 'supplier', field: 'bankName' }, type: 'text', sensitive: true },
        { id: 'q_iban_only', label: 'IBAN', target: { entity: 'supplier', field: 'iban' }, type: 'text', sensitive: true },
      ],
    },
  ];
}

export function generate(options?: { banned?: string[] }): SeedData {
  const rng = seedrandom('redline-supply-v1');
  const importedAt = isoShift(-420);
  const names = new Set<string>();
  const people = new Set<string>();
  const countryQueue = shuffle(rng, COUNTRY_PLAN);

  const weights = Array.from({ length: 64 }, (_, index) => (index + 1) ** -PARETO_ALPHA);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const spends = weights.map((weight) => Math.round((TOTAL_SPEND * weight) / weightSum));
  spends[0] = (spends[0] ?? 0) + (TOTAL_SPEND - spends.reduce((sum, value) => sum + value, 0));
  const spendQueue = shuffle(rng, spends);

  let suppliers: Supplier[] = countryQueue.map((country, index) => {
    const info = COUNTRIES.find((item) => item.code === country) ?? COUNTRIES[0];
    const name = companyName(rng, country, names);
    const city = pick(rng, info.cities);
    const streetNo = int(rng, 2, 80);
    const postal = String(10000 + int(rng, 0, 89999)).slice(0, 5);
    const address = `${pick(rng, STREETS)} ${streetNo}, ${postal} ${city}`;
    const riskScore = int(rng, 12, 96);
    const spend12m = spendQueue[index] ?? 0;
    const fields = {} as Supplier['fields'];
    for (const key of SUPPLIER_FIELD_KEYS) {
      const base = (() => {
        if (key === 'legalName') return name;
        if (key === 'address') return address;
        if (key === 'vatId') return `${country}${String(900000000 + index).slice(0, 9)}`;
        if (key === 'iban') return `DE00${String(index + 1).padStart(18, '0')}`;
        if (key === 'bankName') return pick(rng, ['Nordhafen Clearing', 'Bergkasse Union', 'Ostfeld Giro', 'Alpenkasse']);
        if (key === 'paymentTermsDays') return pick(rng, [14, 30, 30, 45, 60]);
        if (key === 'reachStatus' || key === 'rohsStatus') return declaration(rng);
        return lksg(rng);
      })();
      fields[key] = [version(base, importedAt)];
    }
    return {
      id: `tmp_${index}`,
      name,
      country,
      city,
      website: `https://${slug(name)}.example`,
      topCategory: pick(rng, CATEGORIES),
      riskScore,
      rating: ratingFor(rng, riskScore),
      spend12m,
      spendTrend12m: trend(rng, spend12m),
      fields,
      contactIds: [],
      tags: rng() < 0.3 ? ['Preferred'] : [],
    };
  });

  suppliers = [...suppliers].sort((a, b) => b.spend12m - a.spend12m || a.name.localeCompare(b.name));
  suppliers = suppliers.map((supplier, index) => ({ ...supplier, id: `s${String(index + 1).padStart(2, '0')}` }));

  for (const supplier of suppliers) {
    for (const key of SUPPLIER_FIELD_KEYS) {
      supplier.fields[key] = maybeExtend(rng, supplier.fields[key], (current) => proposeAnswer(key, current, rng) as never, 'req_archive');
    }
  }

  const contacts: Contact[] = [];
  for (const supplier of suppliers) {
    const count = supplier.id === 's02' || rng() < 0.4 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const who = person(rng, people);
      const contact: Contact = {
        id: `c${String(contacts.length + 1).padStart(3, '0')}`,
        supplierId: supplier.id,
        name: who.name,
        email: `${who.emailLocal}@${slug(supplier.name)}.example`,
        role: CONTACT_ROLES[(contacts.length + index) % CONTACT_ROLES.length] ?? 'Sales',
      };
      contacts.push(contact);
      supplier.contactIds.push(contact.id);
    }
  }

  const articles: Article[] = [];
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  function pickSupplier(): Supplier {
    const total = suppliers.reduce((sum, supplier) => sum + supplier.spend12m, 0);
    let ticket = rng() * total;
    for (const supplier of suppliers) {
      ticket -= supplier.spend12m;
      if (ticket <= 0) return supplier;
    }
    return suppliers[suppliers.length - 1] as Supplier;
  }

  for (let index = 0; index < ARTICLE_COUNT; index += 1) {
    const group = CN_GROUPS[index % CN_GROUPS.length] as (typeof CN_GROUPS)[number];
    const primary = pickSupplier();
    const secondary = rng() < 0.08 ? pickSupplier() : undefined;
    const supplierIds = secondary && secondary.id !== primary.id ? [primary.id, secondary.id] : [primary.id];
    const noun = pick(rng, PART_NOUNS[group.code] ?? ['Part']);
    const size = pick(rng, ['mini', '20 mm', '40 mm', '1.5 kW', '3 kW', 'type A', 'type B', 'heavy']);
    const partNo = `${primary.name.slice(0, 3).toUpperCase()}-${10000 + index}`;
    const price = Math.max(80, Math.round(10 ** (2.1 + rng() * 3)) );
    const moq = pick(rng, [1, 10, 25, 50, 100, 250, 500, 1000]);
    const drawing = rng() < 0.35 ? `${slug(noun)}.pdf` : null;
    articles.push({
      id: `a${String(index + 1).padStart(4, '0')}`,
      partNo,
      name: `${noun} ${size}`,
      cnCode: group.code,
      category: group.category,
      supplierIds,
      unit: group.unit,
      fields: {
        unitPrice: [version(price, importedAt)],
        moq: [version(moq, importedAt)],
        co2eKg: [version<number | null>(null, importedAt)],
        drawingFileId: [version<string | null>(drawing, importedAt)],
      },
    });
  }

  const knownOrder = shuffle(rng, articles.map((_, index) => index)).slice(0, KNOWN_CO2E);
  for (const index of knownOrder) {
    const article = articles[index];
    if (!article) continue;
    const kilograms = Math.round((0.15 + rng() * (rng() < 0.08 ? 28 : 8)) * 100) / 100;
    article.fields.co2eKg = [version(kilograms, importedAt)];
  }

  for (const article of articles) {
    article.fields.unitPrice = maybeExtend(rng, article.fields.unitPrice, (current) => proposeAnswer('unitPrice', current, rng) as number, 'req_archive');
    article.fields.moq = maybeExtend(rng, article.fields.moq, (current) => proposeAnswer('moq', current, rng) as number, 'req_archive');
    article.fields.co2eKg = maybeExtend(rng, article.fields.co2eKg, (current) => (current === null ? current : Math.round(((current as number) + 0.1) * 100) / 100), 'req_archive');
    article.fields.drawingFileId = maybeExtend(rng, article.fields.drawingFileId, (current) => current, 'req_archive');
  }

  const categoryCount = new Map<string, Map<string, number>>();
  for (const article of articles) {
    const supplierId = article.supplierIds[0];
    if (!supplierId) continue;
    const counts = categoryCount.get(supplierId) ?? new Map<string, number>();
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    categoryCount.set(supplierId, counts);
  }
  for (const supplier of suppliers) {
    const counts = categoryCount.get(supplier.id);
    if (!counts) continue;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) supplier.topCategory = top[0];
  }

  function articlesFor(supplierId: string): Article[] {
    return articles.filter((article) => article.supplierIds[0] === supplierId);
  }

  function ensure(supplierId: string): Article[] {
    const owned = articlesFor(supplierId);
    if (owned.length >= 2) return owned;
    for (const article of articles) {
      if (article.supplierIds[0] === supplierId) continue;
      if (articlesFor(article.supplierIds[0] ?? '').length <= 2) continue;
      article.supplierIds = [supplierId, ...article.supplierIds.filter((id) => id !== supplierId)];
      if (articlesFor(supplierId).length >= 2) break;
    }
    return articlesFor(supplierId);
  }

  const s01Articles = ensure('s01');
  const s02Articles = ensure('s02');
  const heroA = s01Articles[0] as Article;
  const heroB = s01Articles[1] as Article;
  const heroC = s02Articles[0] as Article;
  const heroD = s02Articles[1] as Article;
  heroA.fields.unitPrice = setLast(heroA.fields.unitPrice, 9800);
  heroB.fields.unitPrice = setLast(heroB.fields.unitPrice, 1100);
  heroC.fields.unitPrice = setLast(heroC.fields.unitPrice, 152000);
  heroD.fields.unitPrice = setLast(heroD.fields.unitPrice, 1025);
  heroC.fields.drawingFileId = setLast(heroC.fields.drawingFileId, null);

  const supplier01 = suppliers[0] as Supplier;
  const supplier02 = suppliers[1] as Supplier;
  supplier01.fields.rohsStatus = setLast(supplier01.fields.rohsStatus, 'unknown');
  supplier01.fields.paymentTermsDays = setLast(supplier01.fields.paymentTermsDays, 30);
  supplier02.fields.rohsStatus = setLast(supplier02.fields.rohsStatus, 'missing');

  const changes: ProposedChange[] = [];
  const pushChange = (change: Omit<ProposedChange, 'id' | 'sensitive' | 'decisions' | 'state'> & { sensitive?: boolean }) => {
    const id = `chg_${String(changes.length + 1).padStart(4, '0')}`;
    changes.push({
      decisions: [],
      state: 'to_review',
      sensitive: change.sensitive ?? isSensitiveValue(change.field, change.from, change.to),
      ...change,
      id,
    });
    return id;
  };

  const atRohs = isoShift(-2);
  const contact01 = supplier01.contactIds[0] as string;
  const contact02a = supplier02.contactIds[0] as string;
  const contact02b = supplier02.contactIds[1] ?? contact02a;
  const legal = String(currentOf(supplier01.fields.legalName).value);
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's01',
    field: 'legalName',
    from: legal,
    to: legal.includes('& Co.') ? `${legal} Gruppe` : legal.replace(/ GmbH$/, ' GmbH & Co. KG'),
    source: answerSource('cmp_rohs', contact01, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's01',
    field: 'paymentTermsDays',
    from: 30,
    to: 45,
    source: answerSource('cmp_rohs', contact01, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's01',
    field: 'iban',
    from: currentOf(supplier01.fields.iban).value,
    to: 'DE009999000000000001',
    source: extractedSource('cmp_rohs', 'bank-letter.pdf', 1, 'IBAN: DE009999000000000001', atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's01',
    field: 'rohsStatus',
    from: 'unknown',
    to: 'declared',
    source: answerSource('cmp_rohs', contact01, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'article',
    entityId: heroA.id,
    field: 'unitPrice',
    from: 9800,
    to: 12350,
    source: answerSource('cmp_rohs', contact01, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'article',
    entityId: heroB.id,
    field: 'unitPrice',
    from: 1100,
    to: 1250,
    source: answerSource('cmp_rohs', contact01, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'article',
    entityId: heroC.id,
    field: 'unitPrice',
    from: 152000,
    to: 180000,
    source: extractedSource('cmp_rohs', 'price-sheet.pdf', 2, 'Unit price EUR 1800.00', atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'article',
    entityId: heroC.id,
    field: 'drawingFileId',
    from: null,
    to: 'drawing-24423.pdf',
    source: extractedSource('cmp_rohs', 'drawing-24423.pdf', 2, 'File: drawing-24423.pdf', atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'article',
    entityId: heroD.id,
    field: 'unitPrice',
    from: 1025,
    to: 1150,
    source: answerSource('cmp_rohs', contact02a, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's02',
    field: 'rohsStatus',
    from: 'missing',
    to: 'declared',
    source: answerSource('cmp_rohs', contact02a, atRohs),
  });
  pushChange({
    campaignId: 'cmp_rohs',
    entity: 'supplier',
    entityId: 's02',
    field: 'rohsStatus',
    from: 'missing',
    to: 'exempt',
    source: answerSource('cmp_rohs', contact02b, isoShift(-1)),
  });

  const reachSuppliers = suppliers.slice(2, 32);
  const reachHost = suppliers[2];
  if (reachHost && reachHost.contactIds.length < 2) {
    const who = person(rng, people);
    const contact: Contact = {
      id: `c${String(contacts.length + 1).padStart(3, '0')}`,
      supplierId: reachHost.id,
      name: who.name,
      email: `${who.emailLocal}@${slug(reachHost.name)}.example`,
      role: 'Quality',
    };
    contacts.push(contact);
    reachHost.contactIds.push(contact.id);
  }

  const reachStates: Campaign['recipients'][number]['state'][] = [
    ...Array.from({ length: 11 }, () => 'answered' as const),
    ...Array.from({ length: 3 }, () => 'partial' as const),
    ...Array.from({ length: 2 }, () => 'bounced' as const),
    ...Array.from({ length: 6 }, () => 'opened' as const),
    ...Array.from({ length: 8 }, () => 'sent' as const),
  ];
  const reachRecipients = reachSuppliers.map((supplier, index) => {
    const state = reachStates[index] ?? 'sent';
    const owned = articlesFor(supplier.id).slice(0, 2);
    return {
      contactId: supplier.contactIds[0] as string,
      supplierId: supplier.id,
      articleIds: owned.map((article) => article.id),
      state,
      ...(state === 'answered' || state === 'partial' ? { lastResponseAt: isoShift(-4 + (index % 3)) } : {}),
    };
  });
  const conflictSupplier = reachSuppliers[0] as Supplier;
  const conflictContact = conflictSupplier.contactIds[1];
  if (conflictContact) {
    reachRecipients.push({
      contactId: conflictContact,
      supplierId: conflictSupplier.id,
      articleIds: reachRecipients[0]?.articleIds ?? [],
      state: 'answered',
      lastResponseAt: isoShift(-3),
    });
  }
  for (const recipient of reachRecipients) {
    if (recipient.state !== 'answered' && recipient.state !== 'partial') continue;
    const supplier = supplierById.get(recipient.supplierId) as Supplier;
    const reachFrom = currentOf(supplier.fields.reachStatus).value;
    const reachTo = recipient.contactId === conflictContact ? 'missing' : reachFrom === 'declared' ? 'exempt' : 'declared';
    pushChange({
      campaignId: 'cmp_reach',
      entity: 'supplier',
      entityId: supplier.id,
      field: 'reachStatus',
      from: reachFrom,
      to: reachTo,
      source: answerSource('cmp_reach', recipient.contactId, recipient.lastResponseAt ?? isoShift(-4)),
    });
    if (recipient.state !== 'answered' || recipient.contactId !== supplier.contactIds[0]) continue;
    for (const articleId of recipient.articleIds) {
      const article = articles.find((item) => item.id === articleId) as Article;
      const priceFrom = currentOf(article.fields.unitPrice).value;
      const moqFrom = currentOf(article.fields.moq).value;
      pushChange({
        campaignId: 'cmp_reach',
        entity: 'article',
        entityId: article.id,
        field: 'unitPrice',
        from: priceFrom,
        to: proposeAnswer('unitPrice', priceFrom, rng),
        source: rng() < 0.2
          ? extractedSource('cmp_reach', 'quote.pdf', 2, 'Unit price EUR 18.40', recipient.lastResponseAt ?? isoShift(-4))
          : answerSource('cmp_reach', recipient.contactId, recipient.lastResponseAt ?? isoShift(-4)),
      });
      pushChange({
        campaignId: 'cmp_reach',
        entity: 'article',
        entityId: article.id,
        field: 'moq',
        from: moqFrom,
        to: proposeAnswer('moq', moqFrom, rng),
        source: answerSource('cmp_reach', recipient.contactId, recipient.lastResponseAt ?? isoShift(-4)),
      });
    }
  }

  const unknownArticles = articles.filter((article) => currentOf(article.fields.co2eKg).value === null);
  const cbamArticles = unknownArticles.filter((article, index, list) => list.findIndex((item) => item.supplierIds[0] === article.supplierIds[0]) === index).slice(0, 10);
  const cbamRecipients: Recipient[] = cbamArticles.map((article) => ({
    contactId: (supplierById.get(article.supplierIds[0] ?? '')?.contactIds[0] ?? '') as string,
    supplierId: article.supplierIds[0] as string,
    articleIds: [article.id],
    state: 'answered' as const,
    lastResponseAt: isoShift(-3),
  }));
  const cbamSeen = new Set(cbamRecipients.map((recipient) => recipient.supplierId));
  for (const filler of [
    { supplier: supplier01, state: 'opened' as const },
    { supplier: supplier02, state: 'sent' as const },
  ]) {
    if (cbamSeen.has(filler.supplier.id)) continue;
    cbamRecipients.push({
      contactId: filler.supplier.contactIds[0] as string,
      supplierId: filler.supplier.id,
      articleIds: [],
      state: filler.state,
    });
  }
  for (const article of cbamArticles) {
    pushChange({
      campaignId: 'cmp_cbam',
      entity: 'article',
      entityId: article.id,
      field: 'co2eKg',
      from: null,
      to: Math.round((0.8 + rng() * 4) * 100) / 100,
      source: extractedSource('cmp_cbam', 'emissions.pdf', 2, 'CO2e kg 2.40', isoShift(-3)),
      sensitive: true,
    });
  }

  const closedSuppliers = suppliers.filter((supplier) => articlesFor(supplier.id).length > 0).slice(32, 40);
  const closedRecipients = closedSuppliers.map((supplier) => {
    const owned = articlesFor(supplier.id).slice(0, 1);
    return {
      contactId: supplier.contactIds[0] as string,
      supplierId: supplier.id,
      articleIds: owned.map((article) => article.id),
      state: 'answered' as const,
      lastResponseAt: isoShift(-110),
    };
  });
  const closedIds: string[] = [];
  for (const recipient of closedRecipients) {
    const article = articles.find((item) => item.id === recipient.articleIds[0]);
    if (!article) continue;
    const from = currentOf(article.fields.unitPrice).value;
    closedIds.push(
      pushChange({
        campaignId: 'cmp_closed',
        entity: 'article',
        entityId: article.id,
        field: 'unitPrice',
        from,
        to: proposeAnswer('unitPrice', from, rng),
        source: answerSource('cmp_closed', recipient.contactId, isoShift(-110)),
      }),
    );
  }

  const campaigns: Campaign[] = [
    {
      id: 'cmp_reach',
      name: 'Spring REACH declarations',
      templateId: 'tpl_reach',
      tags: ['REACH', 'Compliance'],
      sentAt: isoShift(-21),
      dueAt: isoShift(7),
      sentBy: 'u_buyer',
      approverIds: ['u_buyer', 'u_head'],
      requiredApprovals: 2,
      recipients: reachRecipients,
      status: 'open',
    },
    {
      id: 'cmp_rohs',
      name: 'RoHS refresh, drives and cables',
      templateId: 'tpl_rohs',
      tags: ['RoHS', 'Compliance'],
      sentAt: isoShift(-6),
      dueAt: isoShift(1),
      sentBy: 'u_buyer',
      approverIds: ['u_buyer', 'u_head'],
      requiredApprovals: 2,
      recipients: [
        { contactId: contact01, supplierId: 's01', articleIds: [heroA.id, heroB.id], state: 'answered', lastResponseAt: atRohs },
        { contactId: contact02a, supplierId: 's02', articleIds: [heroC.id, heroD.id], state: 'answered', lastResponseAt: atRohs },
        { contactId: contact02b, supplierId: 's02', articleIds: [heroC.id, heroD.id], state: 'answered', lastResponseAt: isoShift(-1) },
      ],
      status: 'in_review',
    },
    {
      id: 'cmp_cbam',
      name: 'CBAM emissions, batch 1',
      templateId: 'tpl_cbam',
      tags: ['CBAM'],
      sentAt: isoShift(-5),
      dueAt: isoShift(4),
      sentBy: 'u_compliance',
      approverIds: ['u_compliance', 'u_head'],
      requiredApprovals: 2,
      recipients: cbamRecipients,
      status: 'in_review',
    },
    {
      id: 'cmp_closed',
      name: 'Autumn price update',
      templateId: 'tpl_price',
      tags: ['Pricing'],
      sentAt: isoShift(-120),
      dueAt: isoShift(-90),
      sentBy: 'u_buyer',
      approverIds: ['u_buyer', 'u_head'],
      requiredApprovals: 2,
      recipients: closedRecipients,
      status: 'in_review',
    },
    {
      id: 'cmp_draft',
      name: 'Bank detail confirmation',
      templateId: 'tpl_bank',
      tags: ['Onboarding'],
      dueAt: isoShift(20),
      sentBy: 'u_buyer',
      approverIds: ['u_buyer'],
      requiredApprovals: 1,
      recipients: [],
      status: 'draft',
    },
  ];

  const rejectId = closedIds[closedIds.length - 1];
  for (const id of closedIds) {
    const index = changes.findIndex((change) => change.id === id);
    const change = changes[index];
    if (!change) continue;
    const at = isoShift(-100);
    if (id === rejectId) {
      changes[index] = decide(change, 'u_buyer', 'reject', at, 2, 'Price not accepted');
    } else {
      changes[index] = decide(decide(change, 'u_buyer', 'approve', at, 2), 'u_head', 'approve', isoShift(-99), 2);
    }
  }

  const tasks: Task[] = [];
  const evaluations: Evaluation[] = [];
  const documents: SupplierDocument[] = [];
  const activities: ActivityEntry[] = [];
  const taskTitles = ['Chase the open declaration', 'Confirm bank details', 'Review the latest score', 'Ask for a fresh drawing'];
  suppliers.forEach((supplier, index) => {
    for (let taskIndex = 0; taskIndex < 3; taskIndex += 1) {
      tasks.push({
        id: `task_${supplier.id}_${taskIndex}`,
        title: taskTitles[(index + taskIndex) % taskTitles.length] ?? 'Follow up',
        group: pick(rng, ['Quality', 'Compliance', 'Buying']),
        done: rng() < 0.35,
        supplierId: supplier.id,
        due: isoShift(int(rng, -5, 25)),
      });
    }
    const score = supplier.id === 's02' ? 42 : int(rng, 38, 98);
    evaluations.push({
      id: `eval_${supplier.id}`,
      supplierId: supplier.id,
      name: index % 2 === 0 ? 'Quality score 2026' : 'Sustainability check',
      score,
      at: isoShift(-int(rng, 10, 200)),
    });
    if (rng() < 0.7 || supplier.id === 's01') {
      documents.push({
        id: `doc_${supplier.id}_cert`,
        supplierId: supplier.id,
        name: 'Declaration.pdf',
        kind: 'certificate',
        expiresAt: isoShift(supplier.id === 's01' ? 12 : int(rng, 40, 400)),
        fileId: `file_${supplier.id}_cert`,
      });
    }
    if (index < 30) {
      documents.push({
        id: `doc_${supplier.id}_eudr`,
        supplierId: supplier.id,
        name: 'EUDR statement.pdf',
        kind: 'eudr',
        expiresAt: isoShift(index < 24 ? 180 : -20),
        fileId: `file_${supplier.id}_eudr`,
      });
    }
    const contact = contacts.find((item) => item.id === supplier.contactIds[0]);
    activities.push(
      {
        id: `act_${supplier.id}_in`,
        supplierId: supplier.id,
        at: isoShift(-int(rng, 2, 40)),
        kind: 'email_in',
        actor: { type: 'supplier', id: contact?.id ?? supplier.id },
        title: 'Email received',
        body: `From ${contact?.name ?? 'Supplier'}\nSubject: Updated pack\n\nPlease find the latest figures attached.`,
      },
      {
        id: `act_${supplier.id}_out`,
        supplierId: supplier.id,
        at: isoShift(-int(rng, 15, 80)),
        kind: 'email_out',
        actor: { type: 'user', id: 'u_buyer' },
        title: 'Email sent',
        body: `To ${contact?.name ?? 'Supplier'}\nSubject: Data request\n\nWe still need the open declarations before the review.`,
      },
    );
  });

  for (let index = 0; index < 6; index += 1) {
    const supplier = suppliers[(index * 7) % suppliers.length] as Supplier;
    documents.push({
      id: `doc_exp_${index}`,
      supplierId: supplier.id,
      name: index % 2 === 0 ? 'RoHS declaration.pdf' : 'ISO certificate.pdf',
      kind: 'certificate',
      expiresAt: isoShift(3 + index * 4),
      fileId: `file_exp_${index}`,
    });
  }
  for (let index = 0; index < 4; index += 1) {
    const supplier = suppliers[50 + index] as Supplier;
    documents.push({
      id: `doc_old_${index}`,
      supplierId: supplier.id,
      name: 'Expired certificate.pdf',
      kind: 'certificate',
      expiresAt: isoShift(-15 - index),
      fileId: `file_old_${index}`,
    });
  }

  activities.push(
    {
      id: 'act_sys_match',
      supplierId: 's01',
      at: DEMO_NOW,
      kind: 'system',
      actor: { type: 'system', id: 'system' },
      title: 'Matched 4 answers to articles',
    },
    {
      id: 'act_sys_expiry',
      supplierId: 's01',
      at: DEMO_NOW,
      kind: 'system',
      actor: { type: 'system', id: 'system' },
      title: 'Flagged certificates expiring within 30 days',
    },
    {
      id: 'act_sys_gap',
      supplierId: 's02',
      at: DEMO_NOW,
      kind: 'system',
      actor: { type: 'system', id: 'system' },
      title: 'Prepared the CBAM gap list',
    },
    {
      id: 'act_sys_import',
      supplierId: 's03',
      at: DEMO_NOW,
      kind: 'system',
      actor: { type: 'system', id: 'system' },
      title: 'Imported payment terms from ERP',
    },
  );

  let data: SeedData = {
    seedRev: SEED_REV,
    demoNow: DEMO_NOW,
    users: [
      { id: 'u_buyer', name: 'Mara Keller', role: 'buyer' },
      { id: 'u_compliance', name: 'Jonas Berger', role: 'compliance' },
      { id: 'u_head', name: 'Petra Holm', role: 'head' },
    ],
    suppliers,
    contacts,
    articles,
    templates: templates(),
    campaigns,
    changes,
    activities,
    tasks,
    evaluations,
    documents,
  };

  data = applyApproved(data, 'cmp_closed', isoShift(-99));
  if (options?.banned?.length) assertClean(data, options.banned, 'seed');
  return data;
}

export { countryName };
