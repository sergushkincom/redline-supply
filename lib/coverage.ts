import { currentOf } from './fields';
import type { Regulation, SeedData } from './types';

const REGULATIONS: Regulation[] = ['CBAM', 'REACH', 'RoHS', 'EUDR', 'LkSG'];

export function asRegulation(value: string): Regulation | null {
  const upper = value.toUpperCase();
  return REGULATIONS.includes(upper as Regulation) ? (upper as Regulation) : null;
}

export interface CoverageSupplier {
  supplierId: string;
  name: string;
  known: number;
  unknown: number;
}

export interface CoverageResult {
  regulation: Regulation;
  known: number;
  unknown: number;
  total: number;
  ratio: number;
  bySupplier: CoverageSupplier[];
  unknownSupplierIds: string[];
  rows: CoverageRow[];
  formula: string;
  inputs: { known: number; unknown: number; total: number };
  knownLabel: string;
  unknownLabel: string;
}

export interface CoverageRow {
  articleId: string;
  partNo: string;
  name: string;
  cnCode: string;
  category: string;
  supplierId: string;
  supplierName: string;
  known: boolean;
  co2eKg: number | null;
  euDefault: number | null;
}

const EU_DEFAULT_CO2E: Record<string, number> = {
  '8501': 3.4,
  '8504': 4.1,
  '8544': 1.8,
  '8536': 2.2,
  '7318': 1.1,
  '8534': 6.4,
  '8483': 2.6,
  '8413': 3.1,
  '8481': 2.4,
  '7326': 1.9,
  '3926': 2.8,
  '7606': 8.6,
};

function supplierName(data: SeedData, id: string): string {
  return data.suppliers.find((supplier) => supplier.id === id)?.name ?? id;
}

export function coverage(data: SeedData, regulation: Regulation): CoverageResult {
  const rows: CoverageRow[] = data.articles.map((article) => {
    const supplierId = article.supplierIds[0] ?? '';
    const supplier = data.suppliers.find((item) => item.id === supplierId);
    const co2e = currentOf(article.fields.co2eKg).value;
    const co2eKg = typeof co2e === 'number' ? co2e : null;
    let known = false;
    if (regulation === 'CBAM') known = co2eKg !== null;
    if (regulation === 'REACH') {
      const status = supplier ? currentOf(supplier.fields.reachStatus).value : 'unknown';
      known = status === 'declared' || status === 'exempt';
    }
    if (regulation === 'RoHS') {
      const status = supplier ? currentOf(supplier.fields.rohsStatus).value : 'unknown';
      known = status === 'declared' || status === 'exempt';
    }
    if (regulation === 'LkSG') {
      const status = supplier ? currentOf(supplier.fields.lksgSelfAssessment).value : 'missing';
      known = status === 'complete';
    }
    if (regulation === 'EUDR') {
      const now = new Date(data.demoNow).getTime();
      known = data.documents.some(
        (document) =>
          document.supplierId === supplierId &&
          document.kind === 'eudr' &&
          (!document.expiresAt || new Date(document.expiresAt).getTime() >= now),
      );
    }
    return {
      articleId: article.id,
      partNo: article.partNo,
      name: article.name,
      cnCode: article.cnCode,
      category: article.category,
      supplierId,
      supplierName: supplierName(data, supplierId),
      known,
      co2eKg,
      euDefault: regulation === 'CBAM' ? (EU_DEFAULT_CO2E[article.cnCode] ?? null) : null,
    };
  });

  const bySupplierMap = new Map<string, CoverageSupplier>();
  for (const row of rows) {
    const current = bySupplierMap.get(row.supplierId) ?? {
      supplierId: row.supplierId,
      name: row.supplierName,
      known: 0,
      unknown: 0,
    };
    if (row.known) current.known += 1;
    else current.unknown += 1;
    bySupplierMap.set(row.supplierId, current);
  }
  const bySupplier = [...bySupplierMap.values()].sort(
    (a, b) => b.known + b.unknown - (a.known + a.unknown) || a.name.localeCompare(b.name),
  );
  const known = rows.filter((row) => row.known).length;
  const total = rows.length;
  const unknown = total - known;
  const labels = coverageLabels(regulation);
  return {
    regulation,
    known,
    unknown,
    total,
    ratio: total === 0 ? 0 : known / total,
    bySupplier,
    unknownSupplierIds: bySupplier.filter((item) => item.unknown > 0).map((item) => item.supplierId),
    rows,
    formula: labels.formula,
    inputs: { known, unknown, total },
    knownLabel: labels.known,
    unknownLabel: labels.unknown,
  };
}

function coverageLabels(regulation: Regulation): { known: string; unknown: string; formula: string } {
  if (regulation === 'CBAM') {
    return {
      known: 'CO₂e known',
      unknown: 'CO₂e unknown',
      formula: 'articles with a CO₂e value ÷ articles',
    };
  }
  if (regulation === 'REACH') {
    return {
      known: 'REACH declared',
      unknown: 'REACH missing',
      formula: 'articles whose supplier REACH status is declared or exempt ÷ articles',
    };
  }
  if (regulation === 'RoHS') {
    return {
      known: 'RoHS declared',
      unknown: 'RoHS missing',
      formula: 'articles whose supplier RoHS status is declared or exempt ÷ articles',
    };
  }
  if (regulation === 'LkSG') {
    return {
      known: 'LkSG complete',
      unknown: 'LkSG incomplete',
      formula: 'articles whose supplier self-assessment is complete ÷ articles',
    };
  }
  return {
    known: 'EUDR statement valid',
    unknown: 'EUDR statement missing',
    formula: 'articles whose supplier has an unexpired EUDR statement ÷ articles',
  };
}
