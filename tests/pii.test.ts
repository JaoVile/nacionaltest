import { describe, expect, it } from 'vitest';
import {
  mascararIp,
  hashTelefone,
  redactTelefone,
  redactPayload,
  mascararTelefoneShort,
} from '../lib/pii';

describe('mascararIp', () => {
  it('zera os 2 últimos octetos de IPv4', () => {
    expect(mascararIp('192.168.1.42')).toBe('192.168.0.0');
    expect(mascararIp('10.0.0.1')).toBe('10.0.0.0');
  });

  it('mantém os primeiros 4 grupos de IPv6', () => {
    expect(mascararIp('2001:db8:85a3:0:1234:5678:9abc:def0')).toBe('2001:db8:85a3:0::');
  });

  it('lida com null/undefined/string vazia', () => {
    expect(mascararIp(null)).toBeNull();
    expect(mascararIp(undefined)).toBeNull();
    expect(mascararIp('')).toBeNull();
    expect(mascararIp('  ')).toBeNull();
  });

  it('mantém formato esperado em input não-IP', () => {
    expect(mascararIp('localhost')).toBe('localhost');
  });
});

describe('hashTelefone', () => {
  it('é determinístico — mesmo telefone gera mesmo hash', () => {
    const a = hashTelefone('5581999430696');
    const b = hashTelefone('5581999430696');
    expect(a).toBe(b);
    expect(a).toHaveLength(12);
  });

  it('ignora não-dígitos no input', () => {
    const com = hashTelefone('+55 (81) 99943-0696');
    const sem = hashTelefone('5581999430696');
    expect(com).toBe(sem);
  });

  it('diferentes telefones geram hashes diferentes', () => {
    expect(hashTelefone('5581999430696')).not.toBe(hashTelefone('5581992387425'));
  });
});

describe('redactTelefone', () => {
  it('formata como hash:<12hex>:••••<últimos4>', () => {
    const r = redactTelefone('5581999430696');
    expect(r).toMatch(/^hash:[0-9a-f]{12}:••••0696$/);
  });

  it('retorna input se não parecer telefone', () => {
    expect(redactTelefone('123')).toBe('123');
    expect(redactTelefone('abc')).toBe('abc');
  });
});

describe('redactPayload', () => {
  it('redacta valores em chaves de telefone conhecidas', () => {
    const out = redactPayload({
      to: '5581999430696',
      from: '5511999990000',
      destinoReal: '5581999430696',
      placa: 'ABC1234',
    }) as Record<string, string>;

    expect(out.to).toMatch(/^hash:[0-9a-f]{12}:••••0696$/);
    expect(out.from).toMatch(/^hash:[0-9a-f]{12}:••••0000$/);
    expect(out.destinoReal).toMatch(/^hash:[0-9a-f]{12}:••••0696$/);
    expect(out.placa).toBe('ABC1234');
  });

  it('redacta telefones encontrados em qualquer string (regex)', () => {
    const out = redactPayload({
      texto: 'Cliente 5581999430696 ligou ontem',
    }) as { texto: string };
    expect(out.texto).toContain('hash:');
    expect(out.texto).not.toContain('5581999430696');
  });

  it('preserva null, números, booleans e arrays', () => {
    const out = redactPayload({
      n: 42,
      b: true,
      x: null,
      arr: ['ok', '5581999430696'],
    }) as Record<string, unknown>;

    expect(out.n).toBe(42);
    expect(out.b).toBe(true);
    expect(out.x).toBeNull();
    const arr = out.arr as string[];
    expect(arr[0]).toBe('ok');
    expect(arr[1]).toMatch(/^hash:/);
  });

  it('é imutável — não modifica o input', () => {
    const input = { to: '5581999430696' };
    redactPayload(input);
    expect(input.to).toBe('5581999430696');
  });
});

describe('mascararTelefoneShort', () => {
  it('mostra apenas últimos 4 dígitos', () => {
    expect(mascararTelefoneShort('5581999430696')).toBe('••••0696');
  });

  it('retorna string vazia para null', () => {
    expect(mascararTelefoneShort(null)).toBe('');
    expect(mascararTelefoneShort(undefined)).toBe('');
  });
});
