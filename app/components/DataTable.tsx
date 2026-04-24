'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';

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
  rowHeight = 44,
  maxHeight = '560px',
  stickyHeader = true,
  rowClassName,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (!isLoading && rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto rounded-xl border border-slate-200 dark:border-ivory-200/10 bg-white dark:bg-deep-100"
      style={{ maxHeight }}
    >
      <table className="w-full text-sm">
        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
          <tr className="bg-slate-50/90 dark:bg-deep-200/80 backdrop-blur border-b border-slate-200 dark:border-ivory-200/10">
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
          <tbody style={{ height: totalSize, position: 'relative' }}>
            <AnimatePresence initial={false}>
              {virtualItems.map((vr) => {
                const row = rows[vr.index]!;
                const id = getRowId(row);
                const extra = rowClassName?.(row) ?? '';
                return (
                  <motion.tr
                    key={id}
                    layoutId={id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vr.start}px)`,
                      height: rowHeight,
                      display: 'table',
                      tableLayout: 'fixed',
                    }}
                    className={`border-b border-slate-100 dark:border-ivory-200/[0.05]
                                hover:bg-slate-50 dark:hover:bg-ivory-200/[0.03]
                                ${onRowClick ? 'cursor-pointer' : ''} ${extra}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={`px-3 py-2.5
                                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                                    ${col.mono ? 'font-mono' : ''}
                                    ${col.tabular ? 'tabular-nums' : ''}
                                    text-slate-700 dark:text-ivory-200`}
                      >
                        {col.cell(row, vr.index)}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        )}
      </table>
    </div>
  );
}
