/**
 * Carrega o scheduler embedded só no Node.js runtime.
 * `instrumentation.ts` faz dynamic import deste arquivo após checar
 * `process.env.NEXT_RUNTIME === 'nodejs'`. Convenção do Next.js permite
 * tree-shake do conteúdo node-only quando bundlado pro edge.
 */
import { aplicarAgendamento, aplicarPurga } from './lib/scheduler';
import { bootRecovery as bootAutocompleteRecovery } from './lib/autocomplete';

export async function bootScheduler(): Promise<void> {
  try {
    const r = await aplicarAgendamento();
    // eslint-disable-next-line no-console
    console.log('[instrumentation] scheduler:', r);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[instrumentation] scheduler boot falhou:', (e as Error).message);
  }

  try {
    const r = aplicarPurga();
    // eslint-disable-next-line no-console
    console.log('[instrumentation] lgpd purga:', r);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[instrumentation] lgpd purga boot falhou:', (e as Error).message);
  }

  try {
    const r = await bootAutocompleteRecovery();
    // eslint-disable-next-line no-console
    console.log('[instrumentation] autocomplete recovery:', r);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[instrumentation] autocomplete recovery falhou:', (e as Error).message);
  }
}
