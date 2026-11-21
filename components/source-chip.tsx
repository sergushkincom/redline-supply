'use client';

import { sourceLabel } from '@/lib/display';
import type { Locale, Source } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SourceChip({ source, locale }: { source: Source; locale: Locale }) {
  const meta = sourceLabel(source, locale);
  return (
    <span className="group relative inline-flex max-w-full">
      <button
        type="button"
        className={cn(
          'max-w-[220px] truncate rounded-full px-2 py-1 text-left text-[12px] leading-4',
          meta.tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-neutral-bg text-neutral-fg',
        )}
      >
        <span className={meta.tone === 'brand' ? 'mono' : undefined}>{meta.label}</span>
      </button>
      {meta.detail ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-64 rounded-[8px] border border-line bg-white p-2 text-[12px] leading-4 text-secondary shadow-card group-focus-within:block group-hover:block"
        >
          {meta.detail}
        </span>
      ) : null}
    </span>
  );
}
