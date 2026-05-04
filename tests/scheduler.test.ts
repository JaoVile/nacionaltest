import { describe, expect, it } from 'vitest';
import { montarCronExpr, proximaExecucao } from '../lib/scheduler';

describe('montarCronExpr', () => {
  it('produz expressão cron válida com dias úteis', () => {
    expect(montarCronExpr('1,2,3,4,5', 9, 0)).toBe('0 9 * * 1,2,3,4,5');
  });

  it('aceita um único dia', () => {
    expect(montarCronExpr('5', 14, 30)).toBe('30 14 * * 5');
  });

  it('substitui CSV vazio por *', () => {
    expect(montarCronExpr('', 8, 0)).toBe('0 8 * * *');
  });
});

describe('proximaExecucao', () => {
  it('retorna null quando todos os dias são inválidos', () => {
    expect(proximaExecucao('99,abc', 9, 0)).toBeNull();
    expect(proximaExecucao('-1,7', 9, 0)).toBeNull();
  });

  it('encontra próxima execução nos dias selecionados', () => {
    // segunda às 09:00, base num domingo
    const base = new Date('2026-04-26T12:00:00'); // domingo (getDay=0)
    const r = proximaExecucao('1,2,3,4,5', 9, 0, base);
    expect(r).not.toBeNull();
    expect(r!.getDay()).toBe(1); // segunda
    expect(r!.getHours()).toBe(9);
    expect(r!.getMinutes()).toBe(0);
  });

  it('avança para o dia seguinte se hora atual já passou', () => {
    // segunda às 10:00, busca por terça às 9
    const base = new Date('2026-04-27T10:00:00'); // segunda
    const r = proximaExecucao('2', 9, 0, base);
    expect(r).not.toBeNull();
    expect(r!.getDay()).toBe(2);
  });

  it('encontra mesmo dia se hora ainda não passou', () => {
    const base = new Date('2026-04-27T07:00:00'); // segunda 7h
    const r = proximaExecucao('1', 9, 0, base);
    expect(r).not.toBeNull();
    expect(r!.getDay()).toBe(1);
    expect(r!.getDate()).toBe(27);
  });

  it('ignora dias inválidos mas mantém os válidos', () => {
    const base = new Date('2026-04-26T12:00:00'); // domingo
    const r = proximaExecucao('99,1,abc', 9, 0, base);
    expect(r).not.toBeNull();
    expect(r!.getDay()).toBe(1);
  });
});
