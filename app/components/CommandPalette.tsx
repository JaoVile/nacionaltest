'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  LayoutDashboard, Send, History, FileText, Settings2, Search,
  PlayCircle, Sun, Moon, Download, RefreshCw,
} from 'lucide-react';
import { useSfx } from './SfxProvider';

function clickDataButton(attr: string) {
  const el = document.querySelector<HTMLButtonElement>(`[data-${attr}]`);
  if (el) {
    el.click();
    return true;
  }
  return false;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { play } = useSfx();

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function resetG() {
      gPressed = false;
      if (gTimer) { clearTimeout(gTimer); gTimer = null; }
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      const cmdOrCtrl = e.metaKey || e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) play('open');
          return !o;
        });
        resetG();
        return;
      }
      if (e.key === 'Escape') { setOpen(false); resetG(); return; }

      if (inEditable) return;

      // atalhos globais contextuais
      if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
        if (clickDataButton('export-excel')) { e.preventDefault(); play('click'); }
        return;
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        if (clickDataButton('refresh-pendentes')) { e.preventDefault(); play('click'); }
        return;
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        play('click');
        router.push('/disparos');
        return;
      }

      // "g" seguido de h/d/t/c → go-to sequencial (estilo Gmail)
      if (!cmdOrCtrl && e.key.toLowerCase() === 'g' && !gPressed) {
        gPressed = true;
        gTimer = setTimeout(resetG, 900);
        return;
      }
      if (gPressed && !cmdOrCtrl) {
        const dest: Record<string, string> = { h: '/historico', d: '/disparos', t: '/templates', c: '/config', b: '/' };
        const route = dest[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          play('click');
          router.push(route);
        }
        resetG();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [play, router]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      play('click');
      router.push(href);
    },
    [router, play],
  );

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains('dark');
    if (nextDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem('theme', nextDark ? 'dark' : 'light'); } catch {}
    setOpen(false);
    play('click');
  }, [play]);

  const runNow = useCallback(() => {
    setOpen(false);
    play('click');
    if (!clickDataButton('run-now')) {
      toast.info('Abra o Dashboard pra usar esta ação.');
      router.push('/');
    }
  }, [router, play]);

  const exportExcel = useCallback(() => {
    setOpen(false);
    play('click');
    if (!clickDataButton('export-excel')) {
      toast.info('Exportar Excel está disponível no Histórico.');
      router.push('/historico');
    }
  }, [router, play]);

  const refreshPendentes = useCallback(() => {
    setOpen(false);
    play('click');
    if (!clickDataButton('refresh-pendentes')) {
      toast.info('Atualizar pendentes está disponível no Histórico.');
      router.push('/historico');
    }
  }, [router, play]);

  const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[16vh] px-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-xl surface-glass rounded-2xl shadow-elev-3 overflow-hidden"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="Comandos" loop>
              <div className="flex items-center gap-2 border-b border-slate-200/70 dark:border-ivory-200/10 px-3">
                <Search size={16} className="text-slate-400 dark:text-ivory-500" />
                <Command.Input placeholder="Buscar comandos, páginas..." />
                <kbd className="hidden sm:inline text-[0.65rem] font-mono text-slate-400 dark:text-ivory-500 border border-slate-200 dark:border-ivory-200/15 rounded px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>
              <Command.List>
                <Command.Empty>Nada encontrado.</Command.Empty>

                <Command.Group heading="Navegar">
                  <CmdItem onSelect={() => go('/')}          icon={<LayoutDashboard size={15} />} label="Dashboard"      hint="G B" />
                  <CmdItem onSelect={() => go('/disparos')}  icon={<Send size={15} />}            label="Disparos"       hint="G D" />
                  <CmdItem onSelect={() => go('/historico')} icon={<History size={15} />}         label="Histórico"      hint="G H" />
                  <CmdItem onSelect={() => go('/templates')} icon={<FileText size={15} />}        label="Templates"      hint="G T" />
                  <CmdItem onSelect={() => go('/config')}    icon={<Settings2 size={15} />}       label="Configurações"  hint="G C" />
                </Command.Group>

                <Command.Group heading="Ações">
                  <CmdItem onSelect={runNow}           icon={<PlayCircle size={15} className="text-accent" />} label="Executar agora"          hint={`${mod} N`} />
                  <CmdItem onSelect={refreshPendentes} icon={<RefreshCw size={15} />}                          label="Atualizar pendentes"     hint={`${mod} R`} />
                  <CmdItem onSelect={exportExcel}      icon={<Download size={15} />}                           label="Exportar Excel"          hint={`${mod} E`} />
                  <CmdItem onSelect={toggleTheme}      icon={<ThemeIcon />}                                    label="Alternar tema"  />
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CmdItem({
  onSelect, icon, label, hint,
}: { onSelect: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Command.Item onSelect={onSelect}>
      <span className="text-slate-400 dark:text-ivory-500">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="ml-auto text-[0.6rem] font-mono font-semibold tracking-wider text-slate-400 dark:text-ivory-500
                        border border-slate-200 dark:border-ivory-200/15 rounded px-1.5 py-0.5">
          {hint}
        </kbd>
      )}
    </Command.Item>
  );
}

function ThemeIcon() {
  return (
    <>
      <Sun size={15} className="text-slate-400 dark:hidden" />
      <Moon size={15} className="text-ivory-500 hidden dark:inline" />
    </>
  );
}
