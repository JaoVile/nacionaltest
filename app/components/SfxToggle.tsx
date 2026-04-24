'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSfx } from './SfxProvider';

export function SfxToggle() {
  const { enabled, toggle } = useSfx();
  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? 'Sons ativados' : 'Sons desativados'}
      className="flex items-center justify-center w-8 h-8 rounded-xl border
                 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100
                 transition-all duration-200 ease-out-expo
                 dark:border-ivory-200/15 dark:text-ivory-400 dark:hover:text-ivory-100 dark:hover:bg-ivory-200/[0.06]"
    >
      {enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </button>
  );
}
