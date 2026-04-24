'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export type StatChipTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  label: string;
  value: number;
  tone?: StatChipTone;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
}

const toneClass: Record<StatChipTone, { text: string; ring: string; dot: string }> = {
  default: { text: 'text-slate-900 dark:text-ivory-100',        ring: 'ring-slate-900/20 dark:ring-ivory-100/25', dot: 'bg-slate-400 dark:bg-ivory-400' },
  success: { text: 'text-emerald-600 dark:text-emerald-400',    ring: 'ring-emerald-500/35',                      dot: 'bg-emerald-500' },
  warning: { text: 'text-amber-600 dark:text-amber-400',        ring: 'ring-amber-500/35',                        dot: 'bg-amber-500' },
  danger:  { text: 'text-rose-600 dark:text-rose-400',          ring: 'ring-rose-500/35',                         dot: 'bg-rose-500' },
  info:    { text: 'text-accent dark:text-accent-soft',         ring: 'ring-accent/35',                           dot: 'bg-accent dark:bg-accent-soft' },
};

export function StatChip({ label, value, tone = 'default', active = false, onClick, delay = 0 }: Props) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('pt-BR'));
  const t = toneClass[tone];

  useEffect(() => {
    const timer = setTimeout(() => mv.set(value), 80 + delay);
    return () => clearTimeout(timer);
  }, [value, mv, delay]);

  const Tag: 'button' | 'div' = onClick ? 'button' : 'div';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      <Tag
        onClick={onClick}
        className={`group w-full text-left rounded-2xl border p-3.5 transition-all duration-200 ease-out-expo
                    bg-white dark:bg-deep-100
                    border-slate-200 dark:border-ivory-200/10
                    ${onClick ? 'hover:border-slate-300 dark:hover:border-ivory-200/20 hover:shadow-elev-2 hover:-translate-y-0.5 cursor-pointer' : ''}
                    ${active ? `ring-2 ${t.ring} shadow-elev-2` : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-400 dark:text-ivory-500">
            {label}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${t.dot} ${active ? 'animate-pulse-soft' : ''}`} />
        </div>
        <motion.div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${t.text}`}>
          {display}
        </motion.div>
      </Tag>
    </motion.div>
  );
}
