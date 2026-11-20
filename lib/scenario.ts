export interface CostResult {
  cents: number;
  formula: 'quantity × unit_price';
  inputs: { quantity: number; unit_price: number };
}

export function totalCost(unitPriceCents: number, quantity: number): CostResult {
  return {
    cents: unitPriceCents * quantity,
    formula: 'quantity × unit_price',
    inputs: { quantity, unit_price: unitPriceCents },
  };
}

export type Rule =
  | { kind: 'max_suppliers'; count: number }
  | { kind: 'exclude_rating_below'; rating: number }
  | { kind: 'min_payment_terms'; days: number }
  | { kind: 'min_rating'; rating: number };

export function parseRule(text: string): { ok: true; rule: Rule } | { ok: false; error: string } {
  const input = text.trim();
  let match = input.match(/^max\s+(\d+)\s+suppliers?$/i);
  if (match) return { ok: true, rule: { kind: 'max_suppliers', count: Number(match[1]) } };
  match = input.match(/^exclude\s+rating\s+below\s+(\d+)$/i);
  if (match) return { ok: true, rule: { kind: 'exclude_rating_below', rating: Number(match[1]) } };
  match = input.match(/^payment\s+terms\s*(?:>=|≥)\s*(\d+)\s*days$/i);
  if (match) return { ok: true, rule: { kind: 'min_payment_terms', days: Number(match[1]) } };
  match = input.match(/^min(?:imum)?\s+rating\s+(\d+)$/i);
  if (match) return { ok: true, rule: { kind: 'min_rating', rating: Number(match[1]) } };
  return { ok: false, error: 'unsupported' };
}

export interface ScenarioSupplier {
  supplierId: string;
  name: string;
  rating: number;
  paymentTermsDays: number;
  totalCents: number;
}

export function ruleNote(rule: Rule): string {
  if (rule.kind === 'max_suppliers') return `max ${rule.count} suppliers`;
  if (rule.kind === 'exclude_rating_below') return `exclude rating below ${rule.rating}`;
  if (rule.kind === 'min_payment_terms') return `payment terms ≥ ${rule.days} days`;
  return `min rating ${rule.rating}`;
}

export function applyRules(
  suppliers: ScenarioSupplier[],
  rules: Rule[],
): { suppliers: ScenarioSupplier[]; notes: string[] } {
  let next = [...suppliers];
  const notes: string[] = [];
  for (const rule of rules) {
    if (rule.kind === 'exclude_rating_below') {
      next = next.filter((supplier) => supplier.rating >= rule.rating);
    } else if (rule.kind === 'min_rating') {
      next = next.filter((supplier) => supplier.rating >= rule.rating);
    } else if (rule.kind === 'min_payment_terms') {
      next = next.filter((supplier) => supplier.paymentTermsDays >= rule.days);
    } else if (rule.kind === 'max_suppliers') {
      next = [...next].sort((a, b) => a.totalCents - b.totalCents || a.name.localeCompare(b.name)).slice(0, rule.count);
    }
    notes.push(ruleNote(rule));
  }
  return { suppliers: next, notes };
}

export function lowestIds(values: { id: string; amount: number | null }[]): Set<string> {
  const known = values.filter((item): item is { id: string; amount: number } => item.amount !== null);
  if (known.length === 0) return new Set();
  const min = Math.min(...known.map((item) => item.amount));
  return new Set(known.filter((item) => item.amount === min).map((item) => item.id));
}
