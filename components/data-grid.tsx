'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface GridColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  size?: number;
}

function pinStyle(column: { getIsPinned: () => false | 'left' | 'right'; getStart: (position: 'left') => number }, background: string) {
  if (column.getIsPinned() !== 'left') return undefined;
  return { position: 'sticky' as const, left: column.getStart('left'), zIndex: 2, background };
}

export function DataGrid<T extends { id: string }>({
  rows,
  columns,
  visible,
  locale,
  caption,
  selectable = false,
  selected,
  onSelectedChange,
  pageSize = 20,
}: {
  rows: T[];
  columns: GridColumn<T>[];
  visible: string[];
  locale: Locale;
  caption: string;
  selectable?: boolean;
  selected?: RowSelectionState;
  onSelectedChange?: (next: RowSelectionState) => void;
  pageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const defs = useMemo<ColumnDef<T>[]>(() => {
    const dataColumns: ColumnDef<T>[] = columns
      .filter((column) => visible.includes(column.id))
      .map((column) => ({
        id: column.id,
        header: column.header,
        size: column.size,
        accessorFn: (row) => column.sortValue?.(row) ?? '',
        cell: ({ row }) => column.cell(row.original),
        sortingFn: (a, b, id) => {
          const left = a.getValue(id);
          const right = b.getValue(id);
          if (typeof left === 'number' && typeof right === 'number') return left - right;
          return String(left).localeCompare(String(right));
        },
      }));
    if (!selectable) return dataColumns;
    const selectColumn: ColumnDef<T> = {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label={caption}
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox" aria-label={row.id} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
      ),
      enableSorting: false,
    };
    return [selectColumn, ...dataColumns];
  }, [caption, columns, selectable, visible]);

  const table = useReactTable({
    data: rows,
    columns: defs,
    state: {
      sorting,
      rowSelection: selected ?? {},
      columnPinning: { left: [selectable ? 'select' : '', visible.includes('name') ? 'name' : visible[0] ?? ''].filter(Boolean) },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      if (!onSelectedChange) return;
      const next = typeof updater === 'function' ? updater(selected ?? {}) : updater;
      onSelectedChange(next);
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectable,
    initialState: { pagination: { pageSize }, columnPinning: { left: ['select'] } },
  });

  const page = table.getState().pagination;
  const from = rows.length === 0 ? 0 : page.pageIndex * page.pageSize + 1;
  const to = Math.min(rows.length, (page.pageIndex + 1) * page.pageSize);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'border-b border-line px-3 text-[12px] leading-4 font-medium text-tertiary',
                      header.column.getCanSort() && 'cursor-pointer',
                    )}
                    style={{ height: 40, minWidth: header.column.id === 'select' ? 40 : 120, ...pinStyle(header.column, '#F4F5F7') }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : null}
                    {header.column.getIsSorted() === 'desc' ? ' ↓' : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-hover" style={{ height: 48 }}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-line px-3 text-[13px] leading-[18px] whitespace-nowrap text-foreground" style={pinStyle(cell.column, '#FFFFFF')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-4 py-10 text-center text-[13px] text-tertiary">{t(locale, 'emptyFilter')}</p> : null}
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px] text-tertiary">
        <span className="tabular">{t(locale, 'pageStatus', { from, to, total: rows.length })}</span>
        <span className="flex gap-2">
          <button type="button" className="rounded-[6px] px-2 py-1 hover:bg-hover disabled:text-quaternary" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {t(locale, 'previous')}
          </button>
          <button type="button" className="rounded-[6px] px-2 py-1 hover:bg-hover disabled:text-quaternary" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {t(locale, 'next')}
          </button>
        </span>
      </div>
    </div>
  );
}
