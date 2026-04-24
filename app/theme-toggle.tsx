'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      className="relative flex items-center justify-center w-8 h-8 rounded-xl border overflow-hidden
                 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100
                 transition-all duration-300 ease-out-expo
                 dark:border-ivory-200/15 dark:text-ivory-400 dark:hover:text-ivory-100 dark:hover:bg-ivory-200/[0.06]"
    >
      <span
        className={`absolute transition-all duration-400 ease-out-expo ${
          dark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      >
        <Moon size={14} />
      </span>
      <span
        className={`absolute transition-all duration-400 ease-out-expo ${
          dark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
        }`}
      >
        <Sun size={14} />
      </span>
    </button>
  );
}
