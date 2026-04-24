'use client';

import { WifiOff } from 'lucide-react';

export function ModoManualNotice() {
  return (
    <div className="card border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-amber-100 text-amber-600
                        dark:bg-amber-500/15 dark:text-amber-400
                        flex items-center justify-center">
          <WifiOff size={24} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="h-section !text-amber-900 dark:!text-amber-200">
            Sistema de atendimentos fora do ar — modo manual ativo
          </h3>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80 max-w-2xl">
            Não conseguimos buscar os atendimentos automaticamente, mas você ainda pode
            disparar normalmente. Ligue a opção{' '}
            <strong>&quot;Mostrar atendimentos sem dados&quot;</strong> abaixo e use{' '}
            <strong>&quot;+ Adicionar telefone&quot;</strong> para digitar os dados de cada
            prestador manualmente.
          </p>
        </div>
      </div>
    </div>
  );
}
