'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

/**
 * Controle de escala de UI — multiplica html font-size, fazendo Tailwind
 * (base rem) escalar tudo proporcionalmente (texto, padding, gap, radius).
 *
 * - Default 1 = visual EXATO de hoje
 * - Range [0.7, 1.5]; passos de 5%
 * - Persiste em localStorage('ui-scale')
 * - O script inline em layout.tsx aplica antes do primeiro paint pra não dar flash
 */

const STORAGE_KEY = 'ui-scale';
const STEP = 0.05;
const MIN = 0.7;
const MAX = 1.5;

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(MIN, Math.min(MAX, n));
}

export function UiScaleControl() {
  const [scale, setScale] = useState<number>(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
      if (Number.isFinite(stored)) setScale(clampScale(stored));
    } catch {/* ignora */}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.style.setProperty('--ui-scale', String(scale));
    try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch {/* ignora */}
  }, [scale, mounted]);

  const pct = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-mist-200 dark:border-ivory-200/10 bg-white dark:bg-deep-100 p-0.5"
         title="Tamanho da interface — afeta texto, espaçamento e botões. Default 100%.">
      <button
        type="button"
        onClick={() => setScale((s) => clampScale(Math.round((s - STEP) * 100) / 100))}
        disabled={scale <= MIN}
        className="p-1 rounded text-slate-500 hover:text-accent hover:bg-mist-50 dark:text-ivory-400 dark:hover:text-ivory-200 dark:hover:bg-ivory-200/[0.05] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Diminuir tamanho da interface"
      >
        <Minus size={12} />
      </button>
      <span className="px-1.5 text-[0.65rem] font-mono font-semibold tabular-nums text-slate-600 dark:text-ivory-400 select-none min-w-[36px] text-center">
        {pct}%
      </span>
      <button
        type="button"
        onClick={() => setScale((s) => clampScale(Math.round((s + STEP) * 100) / 100))}
        disabled={scale >= MAX}
        className="p-1 rounded text-slate-500 hover:text-accent hover:bg-mist-50 dark:text-ivory-400 dark:hover:text-ivory-200 dark:hover:bg-ivory-200/[0.05] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Aumentar tamanho da interface"
      >
        <Plus size={12} />
      </button>
      {scale !== 1 && (
        <button
          type="button"
          onClick={() => setScale(1)}
          className="p-1 rounded text-slate-500 hover:text-accent hover:bg-mist-50 dark:text-ivory-400 dark:hover:text-ivory-200 dark:hover:bg-ivory-200/[0.05] transition-colors ml-0.5"
          aria-label="Resetar tamanho"
          title="Voltar pro padrão (100%)"
        >
          <RotateCcw size={11} />
        </button>
      )}
    </div>
  );
}
