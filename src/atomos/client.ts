import axios, { AxiosInstance, AxiosError } from 'axios';
import { loadConfig } from '../config';
import { logger } from '../logger';
import { mascararTelefoneShort } from '../../lib/pii';
import type {
  SendMessageRequest,
  SendMessageResponse,
  MessageStatusResponse,
  TemplateValues,
  CompleteSessionRequest,
  SessionDTO,
} from './types';

function makeHttp(): AxiosInstance {
  const cfg = loadConfig();
  return axios.create({
    baseURL: cfg.ATOMOS_BASE_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${cfg.ATOMOS_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

export interface SendArgs {
  to: string;
  values: TemplateValues;
  senderId?: string;
  signal?: AbortSignal;
}

export interface SendResult {
  ok: boolean;
  status: number | null;
  request: SendMessageRequest;
  response: SendMessageResponse | string | null;
  error?: string;
  elapsedMs: number;
}

export async function sendTemplate({ to, values, senderId, signal }: SendArgs): Promise<SendResult> {
  const cfg = loadConfig();
  const http = makeHttp();
  const payload: SendMessageRequest = buildPayload(to, values, senderId);
  const started = Date.now();

  try {
    const { status, data } = await http.post<SendMessageResponse>(
      cfg.ATOMOS_SEND_ENDPOINT,
      payload,
      { signal },
    );
    return {
      ok: true,
      status,
      request: payload,
      response: data,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    const ax = err as AxiosError;
    const status = ax.response?.status ?? null;
    const body = ax.response?.data ?? ax.message;
    // LGPD: mascara telefone destinatário; payload completo é redactado por pino.
    logger.error(
      { status, body, toMask: mascararTelefoneShort(to) },
      'AtomosChat: falha ao enviar',
    );
    return {
      ok: false,
      status,
      request: payload,
      response: (body as SendMessageResponse | string) ?? null,
      error: ax.message,
      elapsedMs: Date.now() - started,
    };
  }
}

/**
 * Template flat em `body` com parâmetros nomeados.
 * Nomes seguem os rótulos do portal do template `notafiscal`:
 * associação, cnpj, placa, protocolo, modelo, valor, data.
 */
function buildPayload(to: string, v: TemplateValues, senderId?: string): SendMessageRequest {
  const cfg = loadConfig();
  return {
    to,
    from: cfg.ATOMOS_CHANNEL_ID,
    body: {
      templateId: cfg.ATOMOS_TEMPLATE_ID,
      parameters: {
        'associação': v.associacao,
        cnpj:         v.cnpj,
        placa:        v.placa,
        protocolo:    v.protocolo,
        modelo:       v.modelo,
        valor:        v.valor,
        data:         v.data,
      },
    },
    ...(senderId ? { senderId } : {}),
  };
}

/** Consulta status de uma mensagem enviada. Útil para confirmar entrega. */
export async function getMessageStatus(
  messageId: string,
  signal?: AbortSignal,
): Promise<MessageStatusResponse | null> {
  const http = makeHttp();
  try {
    const { data } = await http.get<MessageStatusResponse>(
      `/chat/v1/message/${messageId}/status`,
      { signal },
    );
    return data;
  } catch (err) {
    const ax = err as AxiosError;
    logger.error(
      { messageId, status: ax.response?.status, body: ax.response?.data },
      'AtomosChat: falha ao consultar status',
    );
    return null;
  }
}

export interface CompleteSessionResult {
  ok: boolean;
  status: number | null;
  request: CompleteSessionRequest;
  response: SessionDTO | string | null;
  error?: string;
  elapsedMs: number;
}

/**
 * Encerra uma conversa via PUT /chat/v1/session/{id}/complete.
 *
 * Estratégia de detecção indireta de resposta: o response (PublicSessionDTO)
 * traz `lastMessageIn` — se for posterior ao timestamp de envio, o prestador
 * respondeu durante a janela de espera. Use `reactivateOnNewMessage: true`
 * para garantir que respostas posteriores reabram a conversa naturalmente.
 */
export async function completeSession(
  sessionId: string,
  body: CompleteSessionRequest,
  signal?: AbortSignal,
): Promise<CompleteSessionResult> {
  const http = makeHttp();
  const started = Date.now();
  try {
    const { status, data } = await http.put<SessionDTO>(
      `/chat/v1/session/${sessionId}/complete`,
      body,
      { signal },
    );
    return {
      ok: true,
      status,
      request: body,
      response: data,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    const ax = err as AxiosError;
    const status = ax.response?.status ?? null;
    const respBody = ax.response?.data ?? ax.message;
    logger.error(
      { sessionId, status, body: respBody },
      'AtomosChat: falha ao concluir sessão',
    );
    return {
      ok: false,
      status,
      request: body,
      response: (respBody as SessionDTO | string) ?? null,
      error: ax.message,
      elapsedMs: Date.now() - started,
    };
  }
}
