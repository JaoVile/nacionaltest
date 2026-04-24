'use client';

import { motion } from 'framer-motion';
import { InfoHint } from '../components/InfoHint';
import { GLOSSARIO } from '../dashboard/glossario';

const ease = [0.16, 1, 0.3, 1] as const;

interface Props {
  mapeaveis: number;
  ignorados: number;
  testMode: boolean;
  testPhone: string;
}

export function DisparosHero({ mapeaveis, ignorados, testMode, testPhone }: Props) {
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
            Revisar e enviar
          </motion.div>
          <motion.h1
            className="h-display"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease }}
          >
            Escolha quem vai receber
          </motion.h1>
          <motion.p
            className="mt-3 text-base text-slate-600 dark:text-ivory-300 max-w-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
          >
            <strong className="text-slate-900 dark:text-ivory-100 font-semibold tabular-nums">
              {mapeaveis}
            </strong>
            {' '}pronto{mapeaveis === 1 ? '' : 's'} para cobrar
            <InfoHint label="Prontos para cobrar">{GLOSSARIO.prontosCobrar}</InfoHint>
            {ignorados > 0 && (
              <>
                {' · '}
                <strong className="text-slate-900 dark:text-ivory-100 font-semibold tabular-nums">
                  {ignorados}
                </strong>
                {' '}sem dados suficientes
                <InfoHint label="Sem dados suficientes">{GLOSSARIO.naoPodeCobrar}</InfoHint>
              </>
            )}
            .
          </motion.p>
        </div>
        <motion.div
          className="shrink-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease }}
        >
          {testMode ? (
            <span className="badge-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft" />
              Modo de teste · vai para {testPhone}
              <InfoHint label="Modo de teste">{GLOSSARIO.testMode}</InfoHint>
            </span>
          ) : (
            <span className="badge-danger">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse-soft" />
              Produção · números reais
              <InfoHint label="Produção">{GLOSSARIO.producao}</InfoHint>
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}
