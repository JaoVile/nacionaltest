'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSfx } from '../components/SfxProvider';

type Variant = 'primary' | 'default';

interface Props {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay?: number;
  variant?: Variant;
}

export function ActionCard({ href, icon, title, desc, delay = 0, variant = 'default' }: Props) {
  const { play } = useSfx();
  const isPrimary = variant === 'primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      className={isPrimary ? 'md:col-span-2' : ''}
    >
      <Link
        href={href}
        onClick={() => play('click')}
        className={`card-interactive group block relative overflow-hidden h-full
                    ${isPrimary ? 'bg-gradient-to-br from-accent/5 to-transparent border-accent/30 dark:from-accent/10 dark:border-accent/30' : ''}`}
      >
        <div className={`flex items-start ${isPrimary ? 'gap-3 sm:gap-4' : 'gap-2.5 sm:gap-3'}`}>
          <div className={`shrink-0 rounded-lg bg-accent/10 text-accent
                          flex items-center justify-center
                          transition-all duration-300 ease-out-expo
                          group-hover:bg-accent group-hover:text-white group-hover:shadow-glow-accent-soft
                          dark:bg-accent/15 dark:text-accent-soft
                          dark:group-hover:bg-accent-deep dark:group-hover:text-ivory-50
                          ${isPrimary
                            ? 'w-10 h-10 sm:w-12 sm:h-12 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6'
                            : 'w-8 h-8 sm:w-9 sm:h-9'}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className={isPrimary
                ? 'font-display font-semibold text-base sm:text-h-section text-slate-900 dark:text-ivory-200 leading-tight'
                : 'text-sm font-semibold text-slate-900 dark:text-ivory-200 leading-snug'}>
                {title}
              </div>
              <ArrowRight
                size={isPrimary ? 18 : 14}
                className="text-slate-400 group-hover:text-accent
                           dark:text-ivory-500 dark:group-hover:text-accent-soft
                           transition-transform duration-300 ease-out-expo
                           group-hover:translate-x-1 shrink-0"
              />
            </div>
            <div className={`mt-1 text-slate-500 dark:text-ivory-400 leading-relaxed
                             ${isPrimary ? 'text-xs sm:text-sm max-w-md' : 'text-xs'}`}>
              {desc}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
