'use client';

import { Line, LineChart } from 'recharts';

export function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  const data = values.map((value, index) => ({ index, value }));
  return (
    <LineChart width={76} height={28} data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
      <Line type="monotone" dataKey="value" stroke={up ? '#2D5E55' : '#C14F39'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

export function SpendBar({ value, max }: { value: number; max: number }) {
  const width = max <= 0 ? 0 : Math.max(10, Math.min(100, Math.round(Math.sqrt(value / max) * 100)));
  return (
    <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-brand-soft" aria-hidden>
      <span className="block h-full rounded-full bg-brand-fill" style={{ width: `${width}%` }} />
    </span>
  );
}
