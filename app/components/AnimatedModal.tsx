'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { X } from 'lucide-react';

type Variant = 'center' | 'side-right';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: Variant;
  maxWidth?: string;
  title?: string;
  hideClose?: boolean;
}

const ease = [0.16, 1, 0.3, 1] as const;

export function AnimatedModal({
  open, onClose, children,
  variant = 'center',
  maxWidth = 'max-w-md',
  title,
  hideClose = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ${
            variant === 'center' ? 'flex items-center justify-center p-4' : 'flex justify-end'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          {variant === 'center' ? (
            <motion.div
              className={`card w-full ${maxWidth} max-h-[calc(100vh-2rem)] overflow-y-auto shadow-elev-3`}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="flex items-start justify-between mb-3 gap-3 sm:gap-4">
                  <h3 className="font-serif text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-ivory-200">{title}</h3>
                  {!hideClose && <ModalClose onClose={onClose} />}
                </div>
              )}
              {children}
            </motion.div>
          ) : (
            <motion.aside
              className="h-full w-full sm:max-w-md md:max-w-xl bg-white dark:bg-deep-100 shadow-elev-3 border-l border-mist-200 dark:border-ivory-200/10 overflow-y-auto"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 sm:gap-4
                                bg-white/85 dark:bg-deep-100/85 backdrop-blur
                                border-b border-mist-200 dark:border-ivory-200/10
                                px-4 sm:px-6 py-3 sm:py-4">
                  <h3 className="font-serif text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-ivory-200">{title}</h3>
                  {!hideClose && <ModalClose onClose={onClose} />}
                </div>
              )}
              <div className="p-4 sm:p-6">{children}</div>
            </motion.aside>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Fechar"
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100
                 dark:text-ivory-400 dark:hover:text-ivory-100 dark:hover:bg-ivory-200/[0.06]
                 transition-colors duration-200"
    >
      <X size={16} />
    </button>
  );
}
