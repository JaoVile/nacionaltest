/**
 * Next.js instrumentation hook — roda 1x quando o servidor sobe.
 * Usado pra registrar o scheduler embedded a partir do Agendamento gravado em DB.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * O conteúdo node-only fica em `instrumentation-node.ts` — a convenção de nome
 * permite que o Next pule o bundle desse arquivo pro edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { bootScheduler } = await import('./instrumentation-node');
  await bootScheduler();
}
