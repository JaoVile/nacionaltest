'use client';

import { motion } from 'framer-motion';

export type TimelineTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: React.ReactNode;
  timestamp?: string;
  icon?: React.ReactNode;
  tone?: TimelineTone;
}

interface Props {
  events: TimelineEvent[];
  compact?: boolean;
}

const toneStyles: Record<TimelineTone, { dot: string; ring: string }> = {
  default: { dot: 'bg-slate-400 dark:bg-ivory-500',       ring: 'ring-slate-100 dark:ring-deep-50' },
  success: { dot: 'bg-emerald-500',                       ring: 'ring-emerald-100 dark:ring-emerald-500/20' },
  warning: { dot: 'bg-amber-500',                         ring: 'ring-amber-100 dark:ring-amber-500/20' },
  danger:  { dot: 'bg-rose-500',                          ring: 'ring-rose-100 dark:ring-rose-500/20' },
  info:    { dot: 'bg-accent',                            ring: 'ring-accent/15 dark:ring-accent-deep/25' },
};

export function Timeline({ events, compact = false }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-slate-400 dark:text-ivory-500 py-4 text-center">
        Sem eventos.
      </div>
    );
  }

  return (
    <ol className="relative">
      <div
        aria-hidden
        className="absolute left-[11px] top-1 bottom-1 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent dark:from-ivory-200/15 dark:via-ivory-200/15 dark:to-transparent"
      />
      {events.map((ev, i) => {
        const tone = toneStyles[ev.tone ?? 'default'];
        return (
          <motion.li
            key={ev.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className={`relative pl-9 ${compact ? 'pb-3' : 'pb-5'}`}
          >
            <span
              className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full flex items-center justify-center
                          ring-4 ${tone.ring}`}
            >
              {ev.icon ? (
                <span className="text-white flex items-center justify-center w-[22px] h-[22px] rounded-full bg-slate-500 dark:bg-deep-50">
                  {ev.icon}
                </span>
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
              )}
            </span>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="text-sm font-medium text-slate-900 dark:text-ivory-100">{ev.title}</div>
              {ev.timestamp && (
                <div className="text-[0.65rem] font-mono text-slate-400 dark:text-ivory-500 tabular-nums">
                  {ev.timestamp}
                </div>
              )}
            </div>
            {ev.description && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-ivory-400 leading-relaxed">
                {ev.description}
              </div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
