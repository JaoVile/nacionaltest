'use client';

import { Toaster as Sonner } from 'sonner';
import { useEffect, useState } from 'react';

export function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'surface-glass !rounded-2xl !shadow-elev-3 !border',
          title: 'font-sans font-semibold',
          description: 'font-sans',
        },
      }}
    />
  );
}
