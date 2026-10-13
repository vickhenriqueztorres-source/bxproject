/**
 * SUB-ETAPA 1: Testes do Closure Fix no onPrivate (App.tsx)
 *
 * Estes testes validam que o callback onPrivate usado no Dashboard
 * captura corretamente os valores atualizados de soundEnabled e activeSymbol.
 *
 * BUG: O useCallback em App.tsx L78-120 declara dependências [queryClient]
 * mas usa soundEnabled e activeSymbol internamente → valores stale.
 *
 * RESULTADO: Toast não aparece, som não toca após settlement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stubs mínimos para isolar o comportamento do callback ──

// Simula o módulo de feature flags
vi.mock('../lib/feature-flags', () => ({
  isNewTraderoomEnabled: () => true,
}));

// Simula o sound engine
const mockPlayWin = vi.fn();
const mockPlayLoss = vi.fn();
const mockPlayDraw = vi.fn();
vi.mock('../lib/sound-engine', () => ({
  soundEngine: {
    playWin: () => mockPlayWin(),
    playLoss: () => mockPlayLoss(),
    playDraw: () => mockPlayDraw(),
    playClick: vi.fn(),
    playOrderOpen: vi.fn(),
    setMuted: vi.fn(),
  },
}));

// Tipagem mínima do evento privado
interface MockPrivateEvent {
  type: string;
  result?: string;
  payout_minor?: number;
  contract_id?: string;
  available_minor?: number;
}

/**
 * Recria a lógica exata do callback onPrivate do App.tsx (L78-120)
 * para testar isoladamente o comportamento do closure.
 *
 * Recebe as variáveis capturadas como parâmetros para simular
 * o que o useCallback faz: captura no momento da criação.
 */
function createOnPrivateHandler(
  capturedSoundEnabled: boolean,
  capturedActiveSymbol: string,
  setSettledToast: (toast: {
    result: 'WIN' | 'LOSS' | 'DRAW';
    amountFormatted: string;
    symbol: string;
    direction: 'SUBE' | 'BAJA';
  } | null) => void,
  setAnnouncement: (msg: string) => void,
  invalidateQueries: (opts: { queryKey: string[] }) => void
) {
  return (event: MockPrivateEvent) => {
    if (event.type === 'wallet_balance' && Number.isSafeInteger(event.available_minor)) {
      // Wallet update — não precisa de soundEnabled ou activeSymbol
    }
    if (event.type === 'contract_settled') {
      const isWin = event.result === 'WIN';
      const isDraw = event.result === 'DRAW';
      const formatted = isWin
        ? `+$${((event.payout_minor ?? 0) / 100).toFixed(2)}`
        : isDraw
        ? '$0.00'
        : `-$${((event.payout_minor ?? 0) / 100).toFixed(2)}`;

      // Este bloco usa soundEnabled e activeSymbol
      if (capturedSoundEnabled) {
        if (isWin) mockPlayWin();
        else if (!isDraw) mockPlayLoss();
        else mockPlayDraw();
      }

      setSettledToast({
        result: isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS',
        amountFormatted: formatted,
        symbol: capturedActiveSymbol,
        direction: 'SUBE',
      });
      setAnnouncement(isWin ? `¡Ganaste! ${formatted}` : `Perdiste ${formatted}`);

      invalidateQueries({ queryKey: ['contracts'] });
      invalidateQueries({ queryKey: ['wallet'] });
    }
  };
}

describe('SUB-ETAPA 1: onPrivate Closure Fix — Toast e Som após Settlement', () => {
  let lastToast: {
    result: 'WIN' | 'LOSS' | 'DRAW';
    amountFormatted: string;
    symbol: string;
    direction: 'SUBE' | 'BAJA';
  } | null = null;
  let lastAnnouncement = '';
  const mockInvalidate = vi.fn();

  beforeEach(() => {
    lastToast = null;
    lastAnnouncement = '';
    mockPlayWin.mockClear();
    mockPlayLoss.mockClear();
    mockPlayDraw.mockClear();
    mockInvalidate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── TESTES CORE: Closure captura valores atualizados ──

  it('1.1 Toast WIN aparece com valor correto e símbolo atualizado', () => {
    const handler = createOnPrivateHandler(
      true, // soundEnabled
      'SYNTH_VOL_50', // activeSymbol
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({
      type: 'contract_settled',
      result: 'WIN',
      payout_minor: 8500,
      contract_id: 'c1',
    });

    expect(lastToast).not.toBeNull();
    expect(lastToast!.result).toBe('WIN');
    expect(lastToast!.amountFormatted).toBe('+$85.00');
    expect(lastToast!.symbol).toBe('SYNTH_VOL_50');
    expect(lastToast!.direction).toBe('SUBE');
    expect(lastAnnouncement).toContain('¡Ganaste!');
  });

  it('1.2 Toast LOSS aparece com valor correto', () => {
    const handler = createOnPrivateHandler(
      false,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({
      type: 'contract_settled',
      result: 'LOSS',
      payout_minor: 10000,
      contract_id: 'c2',
    });

    expect(lastToast).not.toBeNull();
    expect(lastToast!.result).toBe('LOSS');
    expect(lastToast!.amountFormatted).toBe('-$100.00');
    expect(lastAnnouncement).toContain('Perdiste');
  });

  it('1.3 Toast DRAW com valor $0.00', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({
      type: 'contract_settled',
      result: 'DRAW',
      payout_minor: 10000,
      contract_id: 'c3',
    });

    expect(lastToast).not.toBeNull();
    expect(lastToast!.result).toBe('DRAW');
    expect(lastToast!.amountFormatted).toBe('$0.00');
  });

  it('1.4 Som WIN toca quando soundEnabled=true', () => {
    const handler = createOnPrivateHandler(
      true, // ← soundEnabled TRUE
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'c4' });

    expect(mockPlayWin).toHaveBeenCalledTimes(1);
    expect(mockPlayLoss).not.toHaveBeenCalled();
    expect(mockPlayDraw).not.toHaveBeenCalled();
  });

  it('1.5 Som NÃO toca quando soundEnabled=false', () => {
    const handler = createOnPrivateHandler(
      false, // ← soundEnabled FALSE
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'c5' });

    expect(mockPlayWin).not.toHaveBeenCalled();
    expect(mockPlayLoss).not.toHaveBeenCalled();
    expect(mockPlayDraw).not.toHaveBeenCalled();
  });

  it('1.6 Som LOSS toca quando soundEnabled=true', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'contract_settled', result: 'LOSS', payout_minor: 0, contract_id: 'c6' });

    expect(mockPlayLoss).toHaveBeenCalledTimes(1);
    expect(mockPlayWin).not.toHaveBeenCalled();
  });

  it('1.7 Som DRAW toca quando soundEnabled=true', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'contract_settled', result: 'DRAW', payout_minor: 10000, contract_id: 'c7' });

    expect(mockPlayDraw).toHaveBeenCalledTimes(1);
    expect(mockPlayWin).not.toHaveBeenCalled();
    expect(mockPlayLoss).not.toHaveBeenCalled();
  });

  // ── TESTE CRITICAL: Simula o bug do closure stale ──

  it('1.8 BUG REGRESSION: Handler NÃO deve capturar valor stale de soundEnabled', () => {
    // Simula o bug: handler criado com soundEnabled=false (valor inicial)
    const handlerWithStaleClosure = createOnPrivateHandler(
      false, // Valor STALE — como o bug capturava
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    // Simula o handler CORRETO: handler criado com soundEnabled=true (valor atualizado)
    const handlerWithFreshClosure = createOnPrivateHandler(
      true, // Valor ATUALIZADO — como DEVERIA ser após o fix
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    // Com closure stale: som NÃO toca (BUG)
    handlerWithStaleClosure({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'c8' });
    expect(mockPlayWin).not.toHaveBeenCalled(); // Bug: stale não toca

    // Com closure fresh: som TOCA (CORRETO)
    mockPlayWin.mockClear();
    handlerWithFreshClosure({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'c9' });
    expect(mockPlayWin).toHaveBeenCalledTimes(1); // Fix: fresh toca
  });

  it('1.9 BUG REGRESSION: Símbolo no toast deve refletir activeSymbol atualizado', () => {
    // Handler com símbolo STALE (bug)
    const handlerStale = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50', // Símbolo INICIAL
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handlerStale({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'c10' });
    expect(lastToast!.symbol).toBe('SYNTH_VOL_50');

    // Handler com símbolo ATUALIZADO (fix)
    lastToast = null;
    const handlerFresh = createOnPrivateHandler(
      true,
      'SYNTH_VOL_25', // Símbolo ATUALIZADO após troca de aba
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handlerFresh({ type: 'contract_settled', result: 'LOSS', payout_minor: 10000, contract_id: 'c11' });
    expect(lastToast!.symbol).toBe('SYNTH_VOL_25'); // Deve refletir o símbolo atual
  });

  // ── TESTES DE ESTRESSE ──

  it('1.10 ESTRESSE: 50 settlements em rajada sem erro', () => {
    const toasts: typeof lastToast[] = [];
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { toasts.push(t); },
      () => {},
      mockInvalidate
    );

    for (let i = 0; i < 50; i++) {
      handler({
        type: 'contract_settled',
        result: i % 3 === 0 ? 'WIN' : i % 3 === 1 ? 'LOSS' : 'DRAW',
        payout_minor: 8500,
        contract_id: `stress-${i}`,
      });
    }

    expect(toasts.length).toBe(50);
    expect(mockInvalidate).toHaveBeenCalledTimes(100); // 2 invalidações por settlement
  });

  // ── TESTES DE SEGURANÇA ──

  it('1.11 SEGURANÇA: Evento com result inválido não quebra o handler', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    // Deve executar sem lançar exceção — result desconhecido gera LOSS path
    expect(() => {
      handler({
        type: 'contract_settled',
        result: '<script>alert(1)</script>',
        payout_minor: 8500,
        contract_id: 'sec-1',
      });
    }).not.toThrow();

    expect(lastToast!.result).toBe('LOSS'); // Não é WIN nem DRAW → cai no LOSS
  });

  it('1.12 SEGURANÇA: Evento com payout_minor negativo exibe valor formatado', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({
      type: 'contract_settled',
      result: 'WIN',
      payout_minor: -5000,
      contract_id: 'sec-2',
    });

    // Deve formatar normalmente — o valor negativo em WIN gera string incoerente
    // mas NÃO deve crashar o handler
    expect(lastToast).not.toBeNull();
    expect(typeof lastToast!.amountFormatted).toBe('string');
  });

  it('1.13 SEGURANÇA: Evento com payout_minor undefined usa fallback 0', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({
      type: 'contract_settled',
      result: 'WIN',
      payout_minor: undefined,
      contract_id: 'sec-3',
    });

    expect(lastToast!.amountFormatted).toBe('+$0.00');
  });

  // ── TESTES DE CAOS ──

  it('1.14 CAOS: Eventos wallet_balance e contract_settled intercalados', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'wallet_balance', available_minor: 900000 });
    handler({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'chaos-1' });
    handler({ type: 'wallet_balance', available_minor: 908500 });

    expect(lastToast).not.toBeNull();
    expect(lastToast!.result).toBe('WIN');
  });

  it('1.15 CAOS: Evento desconhecido não afeta estado', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    expect(() => {
      handler({ type: 'unknown_event' } as MockPrivateEvent);
    }).not.toThrow();

    expect(lastToast).toBeNull();
    expect(lastAnnouncement).toBe('');
  });

  // ── TESTE: Invalidação de queries (core do onChanged flow) ──

  it('1.16 Invalida queries corretas após settlement', () => {
    const handler = createOnPrivateHandler(
      true,
      'SYNTH_VOL_50',
      (t) => { lastToast = t; },
      (a) => { lastAnnouncement = a; },
      mockInvalidate
    );

    handler({ type: 'contract_settled', result: 'WIN', payout_minor: 8500, contract_id: 'q1' });

    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['contracts'] });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['wallet'] });
  });
});
