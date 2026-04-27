'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { InfoHint } from '../components/InfoHint';

type Tone = 'default' | 'success' | 'warning';

interface Props {
  label: string;
  value: number;
  hint?: string;
  help?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  format?: 'int' | 'brl' | 'pct';
  delay?: number;
  loading?: boolean;
}

const toneClass: Record<Tone, string> = {
  default: 'text-slate-900 dark:text-ivory-100',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600  dark:text-amber-400',
};

function format(value: number, kind: Props['format']) {
  if (kind === 'brl') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (kind === 'pct') return `${Math.round(value)}%`;
  return Math.round(value).toLocaleString('pt-BR');
}

export function StatCard({
  label, value, hint, help, icon, tone = 'default',
  format: fmt = 'int', delay = 0, loading = false,
}: Props) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) => format(v, fmt));

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => mv.set(value), 120 + delay);
    return () => clearTimeout(t);
  }, [value, mv, delay, loading]);

  return (
    <motion.div
      className="card-interactive group relative overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-slate-400 dark:text-ivory-500 [&>svg]:w-4 [&>svg]:h-4" aria-hidden>
            {icon}
          </span>
        )}
        <span className="stat-label">{label}</span>
        {help && <InfoHint label={label}>{help}</InfoHint>}
      </div>
      {loading ? (
        <div className="mt-2 h-10 w-24 rounded-md bg-slate-100 dark:bg-deep-50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-ivory-200/10 to-transparent animate-shimmer" />
        </div>
      ) : (
        <motion.div
          className={`mt-2 font-bold tabular-nums tracking-tight leading-tight break-words ${toneClass[tone]}`}
          style={{ fontSize: 'clamp(1.1rem, 3vw + 0.5rem, 2.5rem)' }}
        >
          {display}
        </motion.div>
      )}
      {hint && <div className="mt-2 text-xs text-slate-500 dark:text-ivory-400">{hint}</div>}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full
                   bg-accent/10 blur-2xl opacity-0 transition-opacity duration-500
                   group-hover:opacity-100"
      />
    </motion.div>
  );
}
