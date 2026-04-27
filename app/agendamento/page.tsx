import { prisma } from '../../lib/db';
import { carregarAtendimentos } from '../../lib/atendimentos';
import { montarCronExpr, proximaExecucao } from '../../lib/scheduler';
import { AgendamentoClient } from './agendamento-client';
import { AutoRefresh } from '../components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AgendamentoPage() {
  const a = await prisma.agendamento.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  const placasIds = a.placas ? (JSON.parse(a.placas) as string[]) : [];
  const cronExpr = montarCronExpr(a.diasSemana, a.hora, a.minuto);
  const proxima = a.ativo ? proximaExecucao(a.diasSemana, a.hora, a.minuto) : null;

  // Carrega atendimentos do período padrão pra mostrar como opções no modo "selecionados"
  const { mapeaveis } = await carregarAtendimentos().catch(() => ({ mapeaveis: [], erro: null, ignorados: [], total: 0, somaValor: 0, dataInicial: '', dataFinal: '' }));

  const atendimentosResumo = mapeaveis.map((m) => ({
    id: m.id,
    placa: m.placa,
    modelo: m.modelo,
    valorFmt: m.valorFmt,
    dataFmt: m.dataFmt,
    prestador: m.prestador,
  }));

  return (
    <div className="page-shell">
      <header className="mb-6 sm:mb-8">
        <p className="eyebrow mb-2">Automação</p>
        <h1 className="h-page mb-2">Agendamento</h1>
        <p className="text-sm text-slate-600 dark:text-ivory-400 max-w-2xl">
          Configure dias e horário para o sistema disparar as cobranças sozinho —
          em massa (tudo do período) ou só as placas que você selecionar.
        </p>
      </header>

      <AgendamentoClient
        initial={{
          ativo: a.ativo,
          modo: a.modo as 'massa' | 'selecionados',
          diasSemana: a.diasSemana.split(',').filter(Boolean).map(Number),
          hora: a.hora,
          minuto: a.minuto,
          placas: placasIds,
          cronExpr,
          proximaExec: proxima ? proxima.toISOString() : null,
          ultimaExec: a.ultimaExec ? a.ultimaExec.toISOString() : null,
          ultimoTotal: a.ultimoTotal,
          ultimoOk: a.ultimoOk,
          ultimoFalha: a.ultimoFalha,
          ultimoErro: a.ultimoErro,
        }}
        atendimentos={atendimentosResumo}
      />

      <AutoRefresh intervalMs={180_000} />
    </div>
  );
}
