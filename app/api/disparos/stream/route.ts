import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadConfig, assertAtomosReady } from '../../../../src/config';
import { sendTemplate, getMessageStatus } from '../../../../src/atomos/client';
import { carregarPorIds } from '../../../../lib/atendimentos';
import { prisma } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';
import { writeAudit } from '../../../../lib/audit';
import { agendarAutoConclusao } from '../../../../lib/autocomplete';
import { redactPayload } from '../../../../lib/pii';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ManualSchema = z.object({
  id: z.string(),
  placa: z.string(),
  modelo: z.string(),
  valor: z.number().nullable(),
  valorFmt: z.string(),
  dataISO: z.string(),
  dataFmt: z.string(),
  telefone: z.string(),
  prestador: z.string(),
  associacao: z.string().default(''),
  cnpj: z.string().default(''),
  protocolo: z.string().default(''),
});

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(0).max(500).default([]),
  manuais: z.array(ManualSchema).max(100).default([]),
  skipGate: z.boolean().optional(),
}).refine((b) => b.ids.length + b.manuais.length > 0, {
  message: 'Envie ao menos um id ou manual',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function POST(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const rl = checkRateLimit(authed.email, '/api/disparos/stream');
  if (!rl.ok) return rl.response!;

  const cfg = loadConfig();
  const encoder = new TextEncoder();

  function emit(controller: ReadableStreamDefaultController, data: object) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      /* controller fechado */
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        assertAtomosReady(cfg);
      } catch (e) {
        emit(controller, { type: 'fatal', message: (e as Error).message });
        controller.close();
        return;
      }

      let parsed;
      try {
        parsed = BodySchema.parse(await req.json());
      } catch (e) {
        emit(controller, { type: 'fatal', message: (e as Error).message });
        controller.close();
        return;
      }

      const mapeaveis = await carregarPorIds(parsed.ids);
      const todos = [
        ...mapeaveis,
        ...parsed.manuais.map((m) => ({
          ...m,
          telefoneMask: '••••••••',
          mapeavel: true as const,
        })),
      ];
      const limite = cfg.MAX_SENDS_PER_RUN > 0 ? cfg.MAX_SENDS_PER_RUN : todos.length;
      const todosParaDisparar = todos.slice(0, limite);

      const total = todosParaDisparar.length;
      emit(controller, { type: 'start', total });

      type Item = typeof todosParaDisparar[number];

      const montarValues = (m: Item) => ({
        associacao: m.associacao,
        cnpj:       m.cnpj,
        placa:      m.placa,
        protocolo:  m.protocolo ? `NO-${m.protocolo}` : '',
        modelo:     m.modelo,
        valor:      m.valorFmt,
        data:       m.dataFmt,
      });

      async function dispatch(
        m: Item,
        opts: {
          idx: number;
          currentLabel: number;
          destinoForcado?: string;
          origem: 'UI' | 'TEST';
          emitPhase?: 'testing' | 'sending';
        },
      ) {
        const destinoEfetivo = opts.destinoForcado
          ?? (cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : m.telefone);
        const values = montarValues(m);
        const tStart = Date.now();

        emit(controller, {
          type: opts.emitPhase ?? 'sending',
          current: opts.currentLabel,
          total,
          placa: m.placa,
          modelo: m.modelo,
          destinoReal: m.telefone,
          destinoEfetivo,
          testMode: cfg.TEST_MODE || opts.origem === 'TEST',
          values,
        });

        const send = await sendTemplate({
          to: destinoEfetivo,
          values,
          senderId: m.id,
          signal: req.signal,
        });

        let messageId: string | null = null;
        let sessionId: string | null = null;
        let statusFinal: string | null = null;
        let failureReason: string | null = null;
        let statusCheck: unknown = null;

        if (send.ok) {
          const resp = send.response as { id?: string; sessionId?: string | null } | null;
          messageId = typeof resp?.id === 'string' ? resp.id : null;
          sessionId = typeof resp?.sessionId === 'string' ? resp.sessionId : null;
          if (messageId) {
            await sleep(2000);
            if (req.signal.aborted) return { aborted: true as const };
            const chk = await getMessageStatus(messageId, req.signal);
            statusCheck = chk;
            statusFinal = chk?.status ?? null;
            failureReason = chk?.failureReason ?? null;
            if (chk?.sessionId && typeof chk.sessionId === 'string') sessionId = chk.sessionId;
          }
        }

        const statusRegistrado = statusFinal ?? (send.ok ? 'QUEUED' : 'ERROR');

        const disparo = await prisma.disparo.create({
          data: {
            atendimentoId: m.id,
            placa: m.placa,
            modelo: m.modelo,
            valor: m.valor ?? 0,
            dataAtendimento: new Date(m.dataISO),
            prestador: m.prestador || null,
            destinoReal: m.telefone,
            destinoEfetivo,
            testMode: cfg.TEST_MODE || opts.origem === 'TEST',
            templateId: cfg.ATOMOS_TEMPLATE_ID,
            atomosMessageId: messageId,
            atomosSessionId: sessionId,
            ultimoStatus: statusRegistrado,
            failureReason,
            errorMessage: send.ok ? null : (send.error ?? null),
            statusAtualizadoEm: new Date(),
            vPlaca: values.placa,
            vModelo: values.modelo,
            vValor: values.valor,
            vData: values.data,
            // LGPD: redact telefones em payloads salvos. Ver lib/pii.ts.
            requestPayload:  safeJson(redactPayload(send.request)),
            responseBody:    safeJson(redactPayload(send.response)),
            httpStatus:      send.status,
            statusCheckBody: safeJson(redactPayload(statusCheck)),
            rawAtendimento:  safeJson(redactPayload((m as { raw?: unknown }).raw ?? null)),
            elapsedMs:       send.elapsedMs,
            origem: opts.origem,
            eventos: {
              create: { status: statusRegistrado, failureReason },
            },
          },
        });

        const elapsedMs = Date.now() - tStart;
        const ok = send.ok && statusFinal !== 'FAILED';

        // Agenda auto-conclusão da conversa (PUT /v1/session/{id}/complete)
        // após o delay configurado. Worker em memória + recovery no boot
        // garantem execução mesmo após restart. Ver lib/autocomplete.ts.
        if (ok && sessionId) {
          void agendarAutoConclusao(disparo.id, sessionId);
        }

        emit(controller, {
          type: opts.origem === 'TEST' ? 'test-result' : 'result',
          current: opts.currentLabel,
          total,
          disparoId: disparo.id,
          atendimentoId: m.id,
          placa: m.placa,
          modelo: m.modelo,
          destinoReal: m.telefone,
          destinoEfetivo,
          testMode: cfg.TEST_MODE || opts.origem === 'TEST',
          ok,
          status: statusRegistrado,
          failureReason,
          error: send.error ?? null,
          httpStatus: send.status,
          elapsedMs,
          atomosMessageId: messageId,
          atomosSessionId: sessionId,
          templateId: cfg.ATOMOS_TEMPLATE_ID,
          values,
          request: send.request,
          response: send.response,
          statusCheck,
        });

        return { aborted: false as const, ok, statusRegistrado, failureReason };
      }

      // --- GATE DE TESTE PRÉVIO (só quando TEST_MODE=false e não pulado) ---
      const devePassarPorGate =
        !cfg.TEST_MODE && !parsed.skipGate && todosParaDisparar.length > 0;

      if (devePassarPorGate) {
        const primeiro = todosParaDisparar[0]!;
        emit(controller, { type: 'gate-start' });
        const testResult = await dispatch(primeiro, {
          idx: -1,
          currentLabel: 0,
          destinoForcado: cfg.TEST_PHONE_NUMBER,
          origem: 'TEST',
          emitPhase: 'testing',
        });

        if (req.signal.aborted) {
          emit(controller, { type: 'canceled', reason: 'cancelado pelo usuário durante o teste' });
          controller.close();
          return;
        }

        if (!testResult || testResult.aborted) {
          emit(controller, { type: 'canceled', reason: 'envio teste interrompido' });
          controller.close();
          return;
        }

        const statusTest = testResult.statusRegistrado;
        const testOk = testResult.ok && !['FAILED', 'ERROR'].includes(statusTest);
        if (!testOk) {
          emit(controller, {
            type: 'aborted',
            reason: `Envio teste falhou (status=${statusTest}${testResult.failureReason ? `: ${testResult.failureReason}` : ''}). Nenhum envio real foi feito.`,
          });
          controller.close();
          return;
        }

        // countdown de 15s
        const COUNTDOWN = 15;
        for (let s = COUNTDOWN; s > 0; s--) {
          if (req.signal.aborted) {
            emit(controller, { type: 'canceled', reason: 'cancelado durante contagem regressiva' });
            controller.close();
            return;
          }
          emit(controller, { type: 'countdown', remaining: s, total: COUNTDOWN });
          await sleep(1000);
        }
        emit(controller, { type: 'gate-passed' });
      }

      // --- LOOP PRINCIPAL ---
      let canceladoNoLoop = false;
      let okLoop = 0;
      let queuedLoop = 0;
      for (let idx = 0; idx < todosParaDisparar.length; idx++) {
        if (req.signal.aborted) {
          canceladoNoLoop = true;
          break;
        }
        const m = todosParaDisparar[idx]!;
        const r = await dispatch(m, {
          idx,
          currentLabel: idx + 1,
          origem: 'UI',
        });
        if (!r || r.aborted || req.signal.aborted) {
          canceladoNoLoop = true;
          break;
        }
        if (r.ok) {
          if (r.statusRegistrado === 'QUEUED') queuedLoop++;
          else okLoop++;
        }
        if (idx < todosParaDisparar.length - 1) {
          await sleep(cfg.SEND_DELAY_MS);
          if (req.signal.aborted) {
            canceladoNoLoop = true;
            break;
          }
        }
      }

      if (canceladoNoLoop) {
        emit(controller, { type: 'canceled', reason: 'cancelado pelo usuário durante os disparos' });
        controller.close();
        return;
      }

      const falhasLoop = total - okLoop - queuedLoop;

      emit(controller, {
        type: 'done',
        total,
        enviadosOk: okLoop,
        queued: queuedLoop,
        falhas: falhasLoop,
        testMode: cfg.TEST_MODE,
        destinoTeste: cfg.TEST_MODE ? cfg.TEST_PHONE_NUMBER : null,
      });

      await writeAudit({
        user: authed,
        action: 'disparo.stream',
        req,
        payload: parsed,
        metadata: {
          total,
          enviadosOk: okLoop,
          queued: queuedLoop,
          falhas: falhasLoop,
          testMode: cfg.TEST_MODE,
          gate: devePassarPorGate,
        },
        statusCode: 200,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
