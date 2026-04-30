/**
 * Utilitários de proteção de dados pessoais (LGPD).
 *
 * - `mascararIp`: zera os 2 últimos octetos de IPv4 / 80 bits finais de IPv6.
 *   Suficiente pra rastreio operacional (rede + região) sem identificar o usuário.
 * - `hashTelefone`: hash determinístico curto (12 hex) — permite busca/match
 *   sem armazenar o número em claro. Concatena últimos 4 dígitos para diagnóstico.
 * - `redactPayload`: percorre objetos arbitrários e substitui valores que parecem
 *   telefone (10–15 dígitos contíguos) pelo formato seguro. Aplicado antes de
 *   gravar `requestPayload` / `responseBody` / `rawAtendimento` no DB.
 *
 * Estratégia: aplica daqui pra frente, sem backfill. Dados anteriores são
 * naturalmente removidos pela rotina de retenção (ver lib/purga.ts).
 */
import { createHash } from 'crypto';

export function mascararTelefoneShort(tel: string | null | undefined): string {
  if (!tel) return '';
  const d = String(tel).replace(/\D/g, '').slice(-4);
  return `••••${d}`;
}

/**
 * Mascara IP zerando últimos octetos.
 * IPv4: `192.168.1.42` → `192.168.0.0`
 * IPv6: `2001:db8::abcd` → `2001:db8::`
 * Retorna null se input for null.
 */
export function mascararIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const s = String(ip).trim();
  if (!s) return null;

  // IPv6 (contém ':')
  if (s.includes(':')) {
    const parts = s.split(':');
    // Mantém apenas os primeiros 4 grupos (64 bits).
    const head = parts.slice(0, 4).filter((p) => p.length > 0);
    return head.join(':') + '::';
  }

  // IPv4
  const parts = s.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.0.0`;
  }
  return s;
}

/** Hash curto e estável de um telefone, para busca/match sem expor valor. */
export function hashTelefone(tel: string): string {
  const digits = String(tel).replace(/\D/g, '');
  if (!digits) return '';
  return createHash('sha256').update(digits).digest('hex').slice(0, 12);
}

/**
 * Substitui um telefone (string) pelo formato `hash:<12hex>:••••<últimos4>`.
 * Reusa hashTelefone + mascararTelefoneShort.
 */
export function redactTelefone(tel: string): string {
  const digits = String(tel).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return tel;
  return `hash:${hashTelefone(digits)}:${mascararTelefoneShort(digits)}`;
}

/** Marca usada pra detectar se um payload já foi sanitizado. */
const TELEFONE_REGEX = /\b\d{10,15}\b/g;

/** Chaves cujo valor sempre é tratado como telefone (para preservação do formato). */
const PHONE_KEYS = new Set(['to', 'from', 'phone', 'phoneNumber', 'telefone', 'destinoReal', 'destinoEfetivo']);

/**
 * Percorre estrutura arbitrária (objeto/array/string) e mascara valores
 * que parecem telefone. Operação imutável — devolve cópia.
 *
 * Útil pra sanitizar JSON que será persistido em colunas de auditoria.
 */
export function redactPayload<T>(input: T): T {
  return walk(input) as T;
}

function walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return redactString(v);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(walk);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PHONE_KEYS.has(k) && typeof val === 'string') {
        out[k] = redactTelefone(val);
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  }
  return v;
}

function redactString(s: string): string {
  return s.replace(TELEFONE_REGEX, (match) => redactTelefone(match));
}
