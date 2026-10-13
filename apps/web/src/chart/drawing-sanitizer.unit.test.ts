import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDrawingItem,
  loadSafeDrawings,
  saveSafeDrawings,
} from './drawing-sanitizer';
import type { DrawingItem } from './drawing-types';

describe('[FASE 2 HARDENING] Drawing & Storage Sanitizer (Anti-Storage Corruption)', () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, val: string) => mockStorage.set(key, val),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
      get length() {
        return mockStorage.size;
      },
      key: (i: number) => Array.from(mockStorage.keys())[i] ?? null,
    };
  });

  it('DS-01: Valida desenho legítimo preservando coordenadas e cores seguras', () => {
    const validRaw: DrawingItem = {
      id: 'draw-1',
      type: 'horizontal_line',
      p1: { time: 1700000000 as any, price: 1520.5 },
      color: '#00e676',
      lineWidth: 2,
    };

    const validated = validateDrawingItem(validRaw);
    expect(validated).not.toBeNull();
    expect(validated?.id).toBe('draw-1');
    expect(validated?.type).toBe('horizontal_line');
    expect(validated?.p1.price).toBe(1520.5);
    expect(validated?.color).toBe('#00e676');
    expect(validated?.lineWidth).toBe(2);
  });

  it('DS-02: Descarta desenhos com coordenadas corrompidas (NaN, Infinity, preços <= 0)', () => {
    expect(
      validateDrawingItem({
        id: 'bad-1',
        type: 'line',
        p1: { time: 1700000000, price: NaN },
        color: '#fff',
        lineWidth: 1,
      })
    ).toBeNull();

    expect(
      validateDrawingItem({
        id: 'bad-2',
        type: 'line',
        p1: { time: 1700000000, price: -100 },
        color: '#fff',
        lineWidth: 1,
      })
    ).toBeNull();

    expect(
      validateDrawingItem({
        id: 'bad-3',
        type: 'line',
        p1: { time: 0, price: 100 },
        color: '#fff',
        lineWidth: 1,
      })
    ).toBeNull();
  });

  it('DS-03: Sanitiza cores perigosas para prevenir CSS/SVG Injection', () => {
    const maliciousItem: any = {
      id: 'xss-1',
      type: 'horizontal_line',
      p1: { time: 1700000000, price: 100 },
      color: 'red; background-image: url("evil.com")',
      lineWidth: 1,
    };

    const validated = validateDrawingItem(maliciousItem);
    expect(validated).not.toBeNull();
    expect(validated?.color).toBe('#22C47A'); // Fallback seguro Turbo Prata
  });

  it('DS-04: Clampa lineWidth entre 1 e 8', () => {
    const thickItem: any = {
      id: 'thick-1',
      type: 'horizontal_line',
      p1: { time: 1700000000, price: 100 },
      color: '#fff',
      lineWidth: 500,
    };
    expect(validateDrawingItem(thickItem)?.lineWidth).toBe(8);

    const thinItem: any = {
      ...thickItem,
      lineWidth: -5,
    };
    expect(validateDrawingItem(thinItem)?.lineWidth).toBe(1);
  });

  it('DS-05: loadSafeDrawings lida graciosamente com JSON corrompido sem lançar exceção', () => {
    localStorage.setItem('broker_drawings_SYNTH_VOL_50', '{invalid json syntax...]]]///');

    const drawings = loadSafeDrawings('SYNTH_VOL_50');
    expect(drawings).toEqual([]); // Retorna array vazio sem travar a thread
  });

  it('DS-06: saveSafeDrawings e loadSafeDrawings persistem e recuperam dados sanitizados', () => {
    const items: DrawingItem[] = [
      {
        id: 'valid-1',
        type: 'horizontal_line',
        p1: { time: 1700000000 as any, price: 105.2 },
        color: '#22C47A',
        lineWidth: 2,
      },
      {
        id: 'corrupt-2',
        type: 'horizontal_line',
        p1: { time: 1700000000 as any, price: NaN },
        color: '#22C47A',
        lineWidth: 2,
      },
    ];

    saveSafeDrawings('EURUSD_OTC', items);
    const loaded = loadSafeDrawings('EURUSD_OTC');

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('valid-1');
  });
});
