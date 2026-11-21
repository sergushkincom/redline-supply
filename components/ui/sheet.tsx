'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/types';

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  locale,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  locale: Locale;
  children: ReactNode;
}) {
  const openedAt = useRef(0);
  if (open && openedAt.current === 0) openedAt.current = Date.now();
  if (!open) openedAt.current = 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && Date.now() - openedAt.current < 250) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#191919]/30" />
        <Dialog.Content className="fixed top-0 right-0 z-50 flex h-full w-[440px] max-w-full flex-col bg-white shadow-card">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="text-[18px] leading-6">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] leading-[18px] text-tertiary">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-[6px] px-2 py-1 text-[13px] text-tertiary hover:bg-hover">{t(locale, 'close')}</Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
