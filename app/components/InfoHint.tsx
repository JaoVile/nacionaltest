'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Side = 'top' | 'bottom';

interface Props {
  label: string;
  children: React.ReactNode;
  side?: Side;
  className?: string;
}

export function InfoHint({ label, children, side = 'bottom', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const posClass = side === 'top'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <span ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={`Saiba mais: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   text-slate-400 hover:text-accent hover:bg-accent/10
                   dark:text-ivory-500 dark:hover:text-accent-soft
                   transition-colors duration-150 focus:outline-none
                   focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Info className="w-3 h-3" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-50 left-1/2 -translate-x-1/2 ${posClass}
                        w-64 rounded-xl border border-slate-200 bg-white p-3
                        shadow-elev-3 text-xs leading-relaxed text-slate-700
                        dark:border-ivory-200/10 dark:bg-deep-100 dark:text-ivory-200`}
          >
            <strong className="block font-sans font-semibold text-slate-900 dark:text-ivory-100 mb-1">
              {label}
            </strong>
            <span className="font-sans">{children}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
