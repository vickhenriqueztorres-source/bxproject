import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isTraderoomPolishEnabled,
  setTraderoomPolishEnabled,
  resetTraderoomPolishForTesting,
} from './traderoom-polish';
import { BM_COLOR } from './design-tokens';

// Ambiente node: simulamos window/localStorage para cada caso.
type Store = Record<string, string>;
const g = globalThis as any;

function installEnv(search = '', store: Store | 'throw' = {}) {
  g.window = { location: { search } };
  if (store === 'throw') {
    g.localStorage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
    };
  } else {
    g.localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
    };
  }
}

describe('Subetapa 00 — chave TRADEROOM_POLISH', () => {
  beforeEach(() => resetTraderoomPolishForTesting());
  afterEach(() => { delete g.window; delete g.localStorage; resetTraderoomPolishForTesting(); });

  it('padrão ligado sem URL nem storage', () => {
    installEnv();
    expect(isTraderoomPolishEnabled()).toBe(true);
  });

  it('?polish=0 desliga e ?polish=1 liga', () => {
    installEnv('?polish=0');
    expect(isTraderoomPolishEnabled()).toBe(false);
    installEnv('?polish=1');
    expect(isTraderoomPolishEnabled()).toBe(true);
  });

  it('localStorage TRADEROOM_POLISH=false desliga', () => {
    installEnv('', { TRADEROOM_POLISH: 'false' });
    expect(isTraderoomPolishEnabled()).toBe(false);
  });

  it('URL vence localStorage', () => {
    installEnv('?polish=1', { TRADEROOM_POLISH: 'false' });
    expect(isTraderoomPolishEnabled()).toBe(true);
  });

  it('override em memória vence URL e storage, e persiste', () => {
    const store: Store = {};
    installEnv('?polish=1', store);
    setTraderoomPolishEnabled(false);
    expect(isTraderoomPolishEnabled()).toBe(false);
    expect(store.TRADEROOM_POLISH).toBe('false');
  });

  it('é independente de NEW_TRADEROOM', () => {
    installEnv('?new_traderoom=0', { NEW_TRADEROOM: 'false' });
    expect(isTraderoomPolishEnabled()).toBe(true);
  });

  it('segurança: valores estranhos na URL são ignorados', () => {
    for (const v of ['%3Cscript%3E', '2', 'yes', '', 'true; drop']) {
      installEnv(`?polish=${v}`);
      expect(isTraderoomPolishEnabled()).toBe(true);
    }
  });

  it('caos: localStorage lançando exceção não quebra', () => {
    installEnv('', 'throw');
    expect(isTraderoomPolishEnabled()).toBe(true);
    expect(() => setTraderoomPolishEnabled(false)).not.toThrow();
    expect(isTraderoomPolishEnabled()).toBe(false);
  });

  it('caos: sem window nem localStorage (SSR) devolve o padrão', () => {
    expect(isTraderoomPolishEnabled()).toBe(true);
  });

  it('estresse: 10.000 leituras em menos de 50 ms', () => {
    installEnv('?polish=1', {});
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) isTraderoomPolishEnabled();
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

describe('Subetapa 00 — BM_COLOR é a fonte única e bate com o CSS', () => {
  const css = readFileSync(resolve(__dirname, '../styles/tokens-precision.css'), 'utf8');
  const cssVar = (name: string) => css.match(new RegExp('--' + name + ': *(#[0-9A-Fa-f]{6})'))?.[1]?.toUpperCase();

  it('cores do manual de identidade', () => {
    expect(BM_COLOR.profit).toBe('#22C47A');
    expect(BM_COLOR.loss).toBe('#F2545B');
    expect(BM_COLOR.prata).toBe('#DCE1EA');
    expect(BM_COLOR.aco).toBe('#8A92A1');
  });

  it('valores idênticos a tokens-precision.css', () => {
    expect(BM_COLOR.profit).toBe(cssVar('profit'));
    expect(BM_COLOR.loss).toBe(cssVar('loss'));
    expect(BM_COLOR.bg0).toBe(cssVar('bg-0'));
    expect(BM_COLOR.bg2).toBe(cssVar('bg-2'));
    expect(BM_COLOR.bg3).toBe(cssVar('bg-3'));
  });

  it('não contém ciano nem os verdes/vermelhos concorrentes', () => {
    const values = Object.values(BM_COLOR).map((v) => String(v).toUpperCase());
    for (const banned of ['#00E5FF', '#00B4D8', '#00E676', '#22C55E', '#E5484D', '#00E599']) {
      expect(values).not.toContain(banned);
    }
  });

  it('é imutável', () => {
    expect(Object.isFrozen(BM_COLOR)).toBe(true);
  });
});
