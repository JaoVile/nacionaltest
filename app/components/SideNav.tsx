'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '../theme-toggle';
import { SfxToggle } from './SfxToggle';
import { RunStatePill } from './RunStatePill';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SideNav({ open, onClose }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex flex-col
                    border-r border-slate-200 bg-white px-4 py-6
                    transition-transform duration-200 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}
                    md:static md:translate-x-0 md:w-60
                    dark:border-ivory-200/10 dark:bg-deep-200`}
      >
        <div className="mb-8 px-2 flex items-start justify-between">
          <div>
            <div className="text-[0.6rem] font-mono font-semibold uppercase tracking-[0.18em] text-accent dark:text-accent-soft">
              Nacional
            </div>
            <div className="mt-1 font-serif text-xl font-semibold text-slate-900 dark:text-ivory-100 tracking-tight">
              Cobrança de NF
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="md:hidden -mr-1 p-1 text-slate-500 hover:text-slate-900 dark:text-ivory-400 dark:hover:text-ivory-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <RunStatePill />

        <nav className="flex flex-col gap-0.5 flex-1">
          <NavLink href="/" pathname={pathname} onClick={onClose}>Dashboard</NavLink>
          <NavLink href="/disparos" pathname={pathname} onClick={onClose}>Disparos</NavLink>
          <NavLink href="/agendamento" pathname={pathname} onClick={onClose}>Agendamento</NavLink>
          <NavLink href="/historico" pathname={pathname} onClick={onClose}>Histórico</NavLink>
          <NavLink href="/templates" pathname={pathname} onClick={onClose}>Templates</NavLink>
          <NavLink href="/config" pathname={pathname} onClick={onClose}>Configurações</NavLink>
        </nav>

        <div className="mt-auto px-2 flex items-center justify-between">
          <span className="text-[0.6rem] font-mono text-slate-400 dark:text-ivory-500">v0.1.0</span>
          <div className="flex items-center gap-2">
            <SfxToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-3 px-2 text-[0.6rem] font-mono text-slate-400 dark:text-ivory-500 hidden md:flex items-center gap-1.5">
          Abrir comandos
          <kbd className="border border-slate-200 dark:border-ivory-200/15 rounded px-1 py-0.5 text-[0.6rem]">⌘K</kbd>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  href,
  pathname,
  onClick,
  children,
}: {
  href: string;
  pathname: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-link ${active ? 'nav-link-active' : ''}`}
    >
      {children}
    </Link>
  );
}
