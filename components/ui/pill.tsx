import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'ready' | 'bad' | 'wait' | 'neutral' | 'brand';

const tones: Record<PillTone, string> = {
  ready: 'bg-ready-bg text-ready-fg',
  bad: 'bg-bad-bg text-bad-fg',
  wait: 'bg-wait-bg text-wait-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
  brand: 'bg-brand-soft text-brand',
};

const dots: Record<PillTone, string> = {
  ready: 'bg-ready-dot',
  bad: 'bg-bad-dot',
  wait: 'bg-wait-dot',
  neutral: 'bg-neutral-dot',
  brand: 'bg-brand-fill',
};

export function Pill({ tone, children, dot = true }: { tone: PillTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[12px] leading-4 font-medium', tones[tone])}>
      {dot ? <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}
