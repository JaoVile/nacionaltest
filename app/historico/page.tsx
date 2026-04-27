import { prisma } from '../../lib/db';
import { HistoricoClient, type DisparoRow } from './historico-client';
import { HistoricoHero } from './HistoricoHero';
import { AutoRefresh } from '../components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoricoPage() {
  const [raw, agregadoRaw] = await Promise.all([
    prisma.disparo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.disparo.groupBy({
      by: ['ultimoStatus'],
      _count: true,
    }),
  ]);

  const items: DisparoRow[] = raw.map((d) => ({
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    atendimentoId: d.atendimentoId,
    placa: d.placa,
    prestador: d.prestador,
    destinoReal: d.destinoReal,
    destinoEfetivo: d.destinoEfetivo,
    testMode: d.testMode,
    valor: d.valor,
    dataAtendimento: d.dataAtendimento.toISOString(),
    valorFmt: d.vValor,
    dataFmt: d.vData,
    ultimoStatus: d.ultimoStatus,
    failureReason: d.failureReason,
    errorMessage: d.errorMessage,
    atomosMessageId: d.atomosMessageId,
    statusAtualizadoEm: d.statusAtualizadoEm?.toISOString() ?? null,
    origem: d.origem,
  }));

  const agregado: Record<string, number> = {};
  for (const g of agregadoRaw) agregado[g.ultimoStatus] = g._count;

  return (
    <div className="page-shell">
      <HistoricoHero total={items.length} />
      <HistoricoClient items={items} agregado={agregado} />
      <AutoRefresh intervalMs={180_000} />
    </div>
  );
}
