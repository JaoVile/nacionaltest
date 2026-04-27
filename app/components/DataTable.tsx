'use client';

import { motion } from 'framer-motion';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  tabular?: boolean;
  cell: (row: T, index: number) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  skeletonRows?: number;
  empty?: React.ReactNode;
  rowHeight?: number;
  maxHeight?: string;
  stickyHeader?: boolean;
  rowClassName?: (row: T) => string;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  isLoading = false,
  skeletonRows = 8,
  empty,
  maxHeight = '560px',
  stickyHeader = true,
  rowClassName,
}: Props<T>) {
  if (!isLoading && rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className="relative overflow-auto rounded-xl border border-mist-200 dark:border-ivory-200/10 bg-white dark:bg-deep-100"
      style={{ maxHeight }}
    >
      <table className="w-full text-sm">
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className="bg-slate-50/90 dark:bg-deep-200/80 backdrop-blur border-b border-mist-200 dark:border-ivory-200/10">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`px-3 py-2.5 text-[0.6rem] font-mono font-semibold uppercase tracking-widest
                            text-slate-500 dark:text-ivory-400
                            ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        {isLoading ? (
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-ivory-200/5">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3">
                    <div
                      className="h-3 rounded bg-slate-200/70 dark:bg-ivory-200/10 animate-pulse-soft"
                      style={{ width: `${50 + Math.random() * 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ) : (
          <tbody>
            {rows.map((row, idx) => {
              const id = getRowId(row);
              const extra = rowClassName?.(row) ?? '';
              return (
                <motion.tr
                  key={id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, ease, delay: Math.min(idx * 0.005, 0.12) }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-slate-100 dark:border-ivory-200/[0.05]
                              transition-colors hover:bg-mist-50 dark:hover:bg-ivory-200/[0.04]
                              ${onRowClick ? 'cursor-pointer active:bg-mist-100 dark:active:bg-ivory-200/[0.06]' : ''} ${extra}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={`px-3 py-3
                                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                                  ${col.mono ? 'font-mono' : ''}
                                  ${col.tabular ? 'tabular-nums' : ''}
                                  text-slate-700 dark:text-ivory-300`}
                    >
                      {col.cell(row, idx)}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
