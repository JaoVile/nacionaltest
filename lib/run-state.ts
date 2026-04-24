export interface RunState {
  running: boolean;
  current: number;
  total: number;
  startedAt: string | null;
  label: string | null;
}

type Global = typeof globalThis & { __nacionalRunState?: RunState };
const g = globalThis as Global;

if (!g.__nacionalRunState) {
  g.__nacionalRunState = { running: false, current: 0, total: 0, startedAt: null, label: null };
}

export function getRunState(): RunState {
  return { ...g.__nacionalRunState! };
}

export function startRun(total: number, label = 'Disparos') {
  g.__nacionalRunState = {
    running: true,
    current: 0,
    total,
    startedAt: new Date().toISOString(),
    label,
  };
}

export function updateRun(current: number) {
  if (!g.__nacionalRunState) return;
  g.__nacionalRunState.current = current;
}

export function endRun() {
  g.__nacionalRunState = { running: false, current: 0, total: 0, startedAt: null, label: null };
}
