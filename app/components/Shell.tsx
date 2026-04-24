'use client';

import { useState } from 'react';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { SfxProvider } from './SfxProvider';
import { CommandPalette } from './CommandPalette';
import { Toaster } from './Toaster';
import { PageTransition } from './PageTransition';

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SfxProvider>
      <div className="min-h-screen md:flex">
        <SideNav open={open} onClose={() => setOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onOpenNav={() => setOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-slate-50 dark:bg-deep-300">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <CommandPalette />
      <Toaster />
    </SfxProvider>
  );
}
