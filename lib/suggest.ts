export interface RankableSupplier {
  id: string;
  spend12m: number;
  riskScore: number;
}

export function supplierScore(spend12m: number, riskScore: number): number {
  return spend12m * (1 + riskScore / 100);
}

export function suggestRecipients<T extends RankableSupplier>(suppliers: T[], count: number) {
  const ranked = [...suppliers].sort(
    (a, b) => supplierScore(b.spend12m, b.riskScore) - supplierScore(a.spend12m, a.riskScore) || a.id.localeCompare(b.id),
  );
  const picked = ranked.slice(0, Math.max(0, Math.min(count, ranked.length)));
  const total = suppliers.reduce((sum, supplier) => sum + supplier.spend12m, 0);
  const covered = picked.reduce((sum, supplier) => sum + supplier.spend12m, 0);
  return {
    ranked,
    picked,
    coverage: total === 0 ? 0 : covered / total,
    formula: 'spend_12m × (1 + risk_score / 100)',
    inputs: { suppliers: picked.length, spend_covered: covered, spend_total: total },
  };
}

export function countForCoverage<T extends RankableSupplier>(suppliers: T[], target = 0.9): number {
  const ranked = suggestRecipients(suppliers, suppliers.length).ranked;
  const total = suppliers.reduce((sum, supplier) => sum + supplier.spend12m, 0);
  if (total === 0) return Math.min(1, suppliers.length);
  let covered = 0;
  for (let index = 0; index < ranked.length; index += 1) {
    covered += ranked[index].spend12m;
    if (covered / total >= target) return index + 1;
  }
  return ranked.length;
}
