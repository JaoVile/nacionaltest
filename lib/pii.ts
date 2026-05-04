/**
 * Utilitários de proteção de dados pessoais (LGPD).
 * Versão universal (Node.js/Edge/Browser) utilizando Web Crypto API.
 */

export function mascararTelefoneShort(tel: string | null | undefined): string {
  if (!tel) return '';
  const d = String(tel).replace(/\D/g, '').slice(-4);
  return `••••${d}`;
}

/**
 * Mascara IP zerando últimos octetos.
 */
export function mascararIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const s = String(ip).trim();
  if (!s) return null;

  if (s.includes(':')) {
    const parts = s.split(':');
    const head = parts.slice(0, 4).filter((p) => p.length > 0);
    return head.join(':') + '::';
  }

  const parts = s.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.0.0`;
  }
  return s;
}

/** Hash curto e estável de um telefone usando Web Crypto API. */
export async function hashTelefone(tel: string): Promise<string> {
  const digits = String(tel).replace(/\D/g, '');
  if (!digits) return '';

  // TextEncoder e crypto.subtle são nativos no Node 16+, Edge e Navegadores.
  const msgUint8 = new TextEncoder().encode(digits);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.slice(0, 12);
}

/**
 * Substitui um telefone (string) pelo formato `hash:<12hex>:••••<últimos4>`.
 */
export async function redactTelefone(tel: string): Promise<string> {
  const digits = String(tel).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return tel;
  
  const hash = await hashTelefone(digits);
  return `hash:${hash}:${mascararTelefoneShort(digits)}`;
}

const TELEFONE_REGEX = /\b\d{10,15}\b/g;
const PHONE_KEYS = new Set(['to', 'from', 'phone', 'phoneNumber', 'telefone', 'destinoReal', 'destinoEfetivo']);

/**
 * Percorre estrutura arbitrária e mascara valores que parecem telefone.
 */
export async function redactPayload<T>(input: T): Promise<T> {
  return (await walk(input)) as T;
}

async function walk(v: unknown): Promise<unknown> {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return redactString(v);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) {
    return Promise.all(v.map(walk));
  }
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PHONE_KEYS.has(k) && typeof val === 'string') {
        out[k] = await redactTelefone(val);
      } else {
        out[k] = await walk(val);
      }
    }
    return out;
  }
  return v;
}

async function redactString(s: string): Promise<string> {
  const matches = s.match(TELEFONE_REGEX);
  if (!matches) return s;

  let redacted = s;
  for (const match of matches) {
    const replacement = await redactTelefone(match);
    redacted = redacted.replace(match, replacement);
  }
  return redacted;
}