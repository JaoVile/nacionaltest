'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useRunState } from './useRunState';

export function RunStatePill() {
  const state = useRunState();
  if (!state.running) return <AnimatePresence />;

  const pct = state.total > 0 ? Math.min(100, Math.round((state.current / state.total) * 100)) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.96 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-2 mb-3 relative overflow-hidden rounded-xl
                   border border-accent/30 bg-accent/5 px-3 py-2
                   dark:border-accent-deep/40 dark:bg-accent-deep/10"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-accent/30 dark:bg-accent-deep/40 animate-ping" />
            <Zap size={12} className="relative text-accent dark:text-accent-soft" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-accent dark:text-accent-soft">
              Executando
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-ivory-200">
              {state.current}/{state.total} · {pct}%
            </div>
          </div>
        </div>
        <div className="mt-1.5 h-0.5 w-full rounded-full bg-accent/15 dark:bg-accent-deep/25 overflow-hidden">
          <motion.div
            className="h-full bg-accent dark:bg-accent-soft"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
