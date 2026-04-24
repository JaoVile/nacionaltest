import fs from 'fs';
import path from 'path';
import { ConfigClient } from './config-client';

export const dynamic = 'force-dynamic';

const MASKED_KEYS = ['DEVSUL_BEARER_TOKEN', 'ATOMOS_BEARER_TOKEN', 'ATOMOS_CHANNEL_ID'];

function readEnv(): Record<string, string> {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
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
      if (MASKED_KEYS.includes(key) && val.length > 8) {
        val = val.slice(0, 6) + '••••' + val.slice(-3);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

export default function ConfigPage() {
  const env = readEnv();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Edite as configurações do sistema. As alterações são salvas no arquivo{' '}
          <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">.env</code> e entram em vigor imediatamente.
        </p>
      </header>
      <ConfigClient initial={env} />
    </div>
  );
}
