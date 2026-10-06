import { describe, expect, it } from 'vitest';
import { reconnectDelay } from './backoff';
import { tickAction } from './protocol';

describe('[T13-UNIT] sequência do feed e reconexão', () => {
  it('aplica apenas a próxima sequência e detecta duplicata e lacuna', () => {
    expect(tickAction(41, 42)).toBe('apply');
    expect(tickAction(42, 42)).toBe('duplicate');
    expect(tickAction(42, 41)).toBe('duplicate');
    expect(tickAction(42, 44)).toBe('gap');
    expect(tickAction(42, Number.NaN)).toBe('gap');
  });
  it('usa jitter, limite de 30 s e atraso mínimo para evitar reconexão imediata', () => {
    expect(reconnectDelay(0, () => 0)).toBe(100);
    expect(reconnectDelay(0, () => 0.5)).toBe(300);
    expect(reconnectDelay(1, () => 0.5)).toBe(550);
    expect(reconnectDelay(100, () => 0.5)).toBe(15_050);
    expect(reconnectDelay(100, () => 1)).toBe(30_000);
  });
});
