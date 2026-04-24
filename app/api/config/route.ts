import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { clearConfigCache } from '../../../src/config';
import { parseJsonBody } from '../../../lib/api-validation';
import { requireUser } from '../../../lib/auth';
import { writeAudit } from '../../../lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ENV_PATH = path.resolve(process.cwd(), '.env');
const MASKED_KEYS = ['DEVSUL_BEARER_TOKEN', 'ATOMOS_BEARER_TOKEN', 'ATOMOS_CHANNEL_ID'];

function readEnvFile(): string {
  return fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
}

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function patchEnv(content: string, patches: Record<string, string>): string {
  const patched = new Set<string>();
  const lines = content.split('\n').map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const idx = t.indexOf('=');
    if (idx < 0) return line;
    const key = t.slice(0, idx).trim();
    if (key in patches) {
      patched.add(key);
      return `${key}=${patches[key]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(patches)) {
    if (!patched.has(k)) lines.push(`${k}=${v}`);
  }
  return lines.join('\n');
}

function maskValue(key: string, val: string): string {
  if (MASKED_KEYS.includes(key) && val.length > 8) {
    return val.slice(0, 6) + '••••' + val.slice(-3);
  }
  return val;
}

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  try {
    const env = parseEnv(readEnvFile());
    const masked = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, maskValue(k, v)]));
    return NextResponse.json({ env: masked });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}

const PatchSchema = z.object({
  TEST_MODE:            z.enum(['true', 'false']).optional(),
  TEST_PHONE_NUMBER:    z.string().regex(/^\d{10,15}$/, 'E.164 sem "+" (10–15 dígitos)').optional(),
  DEVSUL_LOOKBACK_DAYS: z.string().regex(/^\d+$/, 'número inteiro').optional(),
  DEVSUL_SITUACOES:     z.string().max(200).optional(),
  DEVSUL_BEARER_TOKEN:  z.string().min(1).max(4096).optional(),
  SEND_DELAY_MS:        z.string().regex(/^\d+$/, 'número inteiro').optional(),
  MAX_SENDS_PER_RUN:    z.string().regex(/^\d+$/, 'número inteiro').optional(),
  CRON_SCHEDULE:        z.string().max(100).optional(),
  ATOMOS_BEARER_TOKEN:  z.string().min(1).max(4096).optional(),
  ATOMOS_CHANNEL_ID:    z.string().min(1).max(200).optional(),
  ATOMOS_TEMPLATE_ID:   z.string().min(1).max(200).optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const parsed = await parseJsonBody(req, PatchSchema);
  if (!parsed.ok) {
    await writeAudit({ user: authed, action: 'config.patch', req, statusCode: 400, errorMsg: 'payload inválido' });
    return parsed.response;
  }

  const patches = Object.fromEntries(
    Object.entries(parsed.data)
      .filter(([, v]) => typeof v === 'string' && !v.includes('••')),
  ) as Record<string, string>;

  if (Object.keys(patches).length === 0) {
    return NextResponse.json({ ok: true, aviso: 'Nenhum campo alterado' });
  }

  try {
    const updated = patchEnv(readEnvFile(), patches);
    const tmp = ENV_PATH + '.tmp';
    fs.writeFileSync(tmp, updated, { encoding: 'utf-8' });
    fs.renameSync(tmp, ENV_PATH);
    for (const [k, v] of Object.entries(patches)) {
      process.env[k] = v;
    }
    clearConfigCache();
    await writeAudit({
      user: authed,
      action: 'config.patch',
      req,
      payload: parsed.data,
      metadata: { keys: Object.keys(patches) },
      statusCode: 200,
    });
    return NextResponse.json({ ok: true, salvos: Object.keys(patches) });
  } catch (e) {
    await writeAudit({ user: authed, action: 'config.patch', req, statusCode: 500, errorMsg: (e as Error).message });
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
