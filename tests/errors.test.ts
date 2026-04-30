import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('sanitizeError', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('em dev expõe a mensagem real', async () => {
    process.env.NODE_ENV = 'development';
    const { sanitizeError } = await import('../lib/errors');
    const res = sanitizeError(new Error('falha específica do prisma'));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.erro).toContain('falha específica');
  });

  it('em prod retorna fallback genérico', async () => {
    process.env.NODE_ENV = 'production';
    const { sanitizeError } = await import('../lib/errors');
    const res = sanitizeError(new Error('SELECT failed: connection refused'));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.erro).toBe('Erro interno');
    expect(body.erro).not.toContain('SELECT');
    expect(body.erro).not.toContain('connection refused');
  });

  it('respeita status e fallback customizados', async () => {
    process.env.NODE_ENV = 'production';
    const { sanitizeError } = await import('../lib/errors');
    const res = sanitizeError(new Error('x'), 400, 'Configuração inválida');
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.erro).toBe('Configuração inválida');
  });

  it('lida com não-Error (string, objeto)', async () => {
    process.env.NODE_ENV = 'development';
    const { sanitizeError } = await import('../lib/errors');
    const res = sanitizeError('falha bruta');
    const body = await res.json();
    expect(body.erro).toContain('falha bruta');
  });
});
