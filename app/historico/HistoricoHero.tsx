'use client';

import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

export function HistoricoHero({ total }: { total: number }) {
  return (
    <div className="mesh-hero mb-10">
      <motion.div
        className="eyebrow text-accent dark:text-accent-soft mb-2"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        Histórico de envios
      </motion.div>
      <motion.h1
        className="h-display"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease }}
      >
        O que já saiu daqui
      </motion.h1>
      <motion.p
        className="mt-3 text-base text-slate-600 dark:text-ivory-300 max-w-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.18, ease }}
      >
        Cada linha é uma cobrança que mandamos. Clique numa linha pra ver tudo:
        quem recebeu, quando, o que o WhatsApp respondeu.
        {total > 0 && (
          <>
            {' '}Mostrando{' '}
            <strong className="text-slate-900 dark:text-ivory-100 font-semibold tabular-nums">
              {total}
            </strong>{' '}
            envio{total === 1 ? '' : 's'} (até 500 mais recentes).
          </>
        )}
      </motion.p>
    </div>
  );
}
