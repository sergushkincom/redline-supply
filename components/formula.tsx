'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

export function FormulaReveal({
  locale,
  formula,
  inputs,
}: {
  locale: Locale;
  formula: string;
  inputs: Record<string, string | number>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" className="text-[12px] font-medium text-brand" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? t(locale, 'hideFormula') : t(locale, 'showFormula')}
      </button>
      {open ? (
        <span className="mt-1 rounded-[8px] bg-subtle px-2 py-1.5 text-[12px] leading-4 text-secondary">
          <span className="block font-medium text-foreground">{t(locale, 'formula')}</span>
          <span className="mono mt-0.5 block text-foreground">{formula}</span>
          <span className="mt-1 block">{t(locale, 'inputs')}</span>
          {Object.entries(inputs).map(([key, value]) => (
            <span key={key} className="mono block text-foreground">
              {key} = {value}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
