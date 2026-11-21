'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

export function Menu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { id: string; label: string; onSelect: () => void }[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-30 min-w-56 rounded-[8px] border border-line bg-white p-1 shadow-card" sideOffset={6} align="end">
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              className="cursor-pointer rounded-[6px] px-2 py-2 text-[13px] leading-[18px] text-foreground outline-none data-[highlighted]:bg-hover"
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
