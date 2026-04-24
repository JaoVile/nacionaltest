'use client';

import { Menu } from 'lucide-react';
import { ThemeToggle } from '../theme-toggle';
import { SfxToggle } from './SfxToggle';

interface Props {
  onOpenNav: () => void;
}

export function TopBar({ onOpenNav }: Props) {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-4
                       border-b border-slate-200 bg-white/80 backdrop-blur
                       dark:border-ivory-200/10 dark:bg-deep-100/80">
      <button
        onClick={onOpenNav}
        aria-label="Abrir menu"
        className="-ml-1 p-2 text-slate-600 hover:text-slate-900 dark:text-ivory-300 dark:hover:text-ivory-100"
      >
        <Menu size={20} />
      </button>

      <div className="flex flex-col items-center leading-tight">
        <span className="text-[0.55rem] font-mono font-semibold uppercase tracking-[0.18em] text-accent dark:text-accent-soft">
          Nacional
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-ivory-100">
          Cobrança de NF
        </span>
      </div>

      <div className="flex items-center gap-2">
        <SfxToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
