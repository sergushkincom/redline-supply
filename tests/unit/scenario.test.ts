import { describe, expect, it } from 'vitest';
import { applyRules, parseRule, totalCost } from '@/lib/scenario';

describe('scenario math', () => {
  it('shows quantity times unit price', () => {
    const result = totalCost(12350, 1000);
    expect(result.cents).toBe(12_350_000);
    expect(result.formula).toBe('quantity × unit_price');
    expect(result.inputs).toEqual({ quantity: 1000, unit_price: 12350 });
  });

  it('parses the supported plain-language rules', () => {
    expect(parseRule('max 2 suppliers')).toEqual({ ok: true, rule: { kind: 'max_suppliers', count: 2 } });
    expect(parseRule('exclude rating below 3')).toEqual({ ok: true, rule: { kind: 'exclude_rating_below', rating: 3 } });
    expect(parseRule('payment terms ≥ 30 days')).toEqual({ ok: true, rule: { kind: 'min_payment_terms', days: 30 } });
    expect(parseRule('payment terms >= 45 days')).toEqual({ ok: true, rule: { kind: 'min_payment_terms', days: 45 } });
    expect(parseRule('min rating 4')).toEqual({ ok: true, rule: { kind: 'min_rating', rating: 4 } });
    expect(parseRule('give the work to my cousin').ok).toBe(false);
  });

  it('filters and keeps the cheapest suppliers when a max is set', () => {
    const suppliers = [
      { supplierId: 'a', name: 'A', rating: 2, paymentTermsDays: 14, totalCents: 300 },
      { supplierId: 'b', name: 'B', rating: 5, paymentTermsDays: 45, totalCents: 100 },
      { supplierId: 'c', name: 'C', rating: 4, paymentTermsDays: 30, totalCents: 200 },
    ];
    const result = applyRules(suppliers, [
      { kind: 'exclude_rating_below', rating: 3 },
      { kind: 'min_payment_terms', days: 30 },
      { kind: 'max_suppliers', count: 1 },
    ]);
    expect(result.suppliers.map((item) => item.supplierId)).toEqual(['b']);
    expect(result.notes).toHaveLength(3);
  });
});
