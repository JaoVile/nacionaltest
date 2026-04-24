'use client';

import { motion } from 'framer-motion';
import { InfoHint } from '../components/InfoHint';
import { GLOSSARIO } from './glossario';

interface Props {
  lookbackDias: number;
  mapeaveis: number;
  testMode: boolean;
  children?: React.ReactNode;
}

const ease = [0.16, 1, 0.3, 1] as const;

function saudacao(h: number) {
  if (h < 12) return 'Bom dia!';
  if (h < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

export function Hero({ lookbackDias, mapeaveis, testMode, children }: Props) {
  const titulo = saudacao(new Date().getHours());

  return (
    <div className="mesh-hero mb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="min-w-0">
          <motion.div
            className="eyebrow text-accent dark:text-accent-soft mb-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            Cobrança de Nota Fiscal
          </motion.div>
          <motion.h1
            className="h-display"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease }}
          >
            {titulo}
          </motion.h1>
          <motion.p
            className="mt-3 text-base text-slate-600 dark:text-ivory-300 max-w-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
          >
            Olhando os atendimentos dos últimos{' '}
            <strong className="text-slate-900 dark:text-ivory-100 font-semibold tabular-nums">
              {lookbackDias} dia{lookbackDias === 1 ? '' : 's'}
            </strong>
            .{' '}
            <strong className="text-slate-900 dark:text-ivory-100 font-semibold tabular-nums">
              {mapeaveis}
            </strong>
            {' '}pronto{mapeaveis === 1 ? '' : 's'} para cobrar{' '}
            <InfoHint label="Prontos para cobrar">
              {GLOSSARIO.prontosCobrar}
            </InfoHint>
            .
          </motion.p>
        </div>
        <motion.div
          className="flex items-center gap-3 flex-wrap shrink-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease }}
        >
          {testMode ? (
            <span className="badge-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft" />
              Modo de teste
              <InfoHint label="Modo de teste">{GLOSSARIO.testMode}</InfoHint>
            </span>
          ) : (
            <span className="badge-success">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
              Produção
              <InfoHint label="Produção">{GLOSSARIO.producao}</InfoHint>
            </span>
          )}
          {children}
        </motion.div>
      </div>
    </div>
  );
}
