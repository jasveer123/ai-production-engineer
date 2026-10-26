'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Table, Td, Th, Tr } from './table';

declare module '@tanstack/react-table' {
  // Lets a column pick up alignment/width classes without a wrapper component.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

type DataTableProps<T> = {
  label: string;
  columns: ColumnDef<T>[];
  data: T[];
  getRowId?: (row: T) => string;
  initialSorting?: SortingState;
};

/** TanStack Table rendered with the app's table primitives. Sortable columns get a labelled button. */
export function DataTable<T>({
  label,
  columns,
  data,
  getRowId,
  initialSorting = [],
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table label={label}>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const content = flexRender(header.column.columnDef.header, header.getContext());
              return (
                <Th
                  key={header.id}
                  className={header.column.columnDef.meta?.className}
                  aria-sort={
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                  }
                >
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn('inline-flex items-center gap-1 uppercase hover:text-ink')}
                    >
                      {content}
                      <span aria-hidden="true">
                        {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                      </span>
                    </button>
                  ) : (
                    content
                  )}
                </Th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <Tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Td key={cell.id} className={cell.column.columnDef.meta?.className}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
