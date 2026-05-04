import { prisma } from '../../lib/db';
import { HistoricoClient, type DisparoRow } from './historico-client';
import { HistoricoHero } from './HistoricoHero';
import { AutoRefresh } from '../components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDia(s?: string): { gte: Date; lt: Date; label: string } | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const gte = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const lt  = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
  if (isNaN(gte.getTime())) return null;
  return { gte, lt, label: `${m[3]}/${m[2]}/${m[1]}` };
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: { dia?: string };
}) {
  const dia = parseDia(searchParams.dia);
  const where = dia ? { createdAt: { gte: dia.gte, lt: dia.lt } } : {};

  const [raw, agregadoRaw] = await Promise.all([
    prisma.disparo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.disparo.groupBy({
      where,
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
      <HistoricoClient items={items} agregado={agregado} diaFiltro={dia?.label ?? null} />
      <AutoRefresh intervalMs={180_000} />
    </div>
  );
}
