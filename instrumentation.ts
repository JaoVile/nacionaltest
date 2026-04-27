/**
 * Next.js instrumentation hook — roda 1x quando o servidor sobe.
 * Usado pra registrar o scheduler embedded a partir do Agendamento gravado em DB.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { aplicarAgendamento } = await import('./lib/scheduler');
    const r = await aplicarAgendamento();
    // eslint-disable-next-line no-console
    console.log('[instrumentation] scheduler:', r);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[instrumentation] scheduler boot falhou:', (e as Error).message);
  }
}
