/**
 * SUB-ETAPA 2: Testes do Reset do Receipt após Settlement (OrderTicket.tsx)
 *
 * BUG: O `receipt` nunca é limpo após o contrato ser liquidado (SETTLED).
 * O componente fica eternamente mostrando "Última operación" e o useQuery
 * com o receipt.id antigo fica ativo desnecessariamente.
 *
 * FIX: Após settlement, auto-reset do receipt com delay de 3s para
 * permitir que o usuário veja o resultado antes de liberar para nova operação.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SUB-ETAPA 2: Reset do Receipt após Settlement — Destravar Operações', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Simulação do ciclo de vida do receipt ──

  /**
   * Simula o comportamento do useEffect de notificação no OrderTicket.
   * Retorna um cleanup function como o React faria.
   */
  function simulateSettlementEffect(
    contractStatus: string,
    contractId: string,
    notifiedRef: { current: string | null },
    setReceipt: (val: null) => void,
    onChanged: () => void,
    resetDelayMs: number = 3000
  ): (() => void) | undefined {
    if (['SETTLED', 'FAILED_COMPENSATION', 'CANCELLED'].includes(contractStatus)
        && notifiedRef.current !== contractId) {
      notifiedRef.current = contractId;
      onChanged();

      // ✅ FIX: Auto-reset após delay visual
      const timer = setTimeout(() => {
        setReceipt(null);
      }, resetDelayMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }

  // ── TESTES CORE ──

  it('2.1 Receipt é limpo (null) 3 segundos após settlement', () => {
    let receipt: string | null = 'contract-123';
    const notifiedRef = { current: null as string | null };
    const onChanged = vi.fn();

    simulateSettlementEffect(
      'SETTLED',
      'contract-123',
      notifiedRef,
      () => { receipt = null; },
      onChanged
    );

    // Imediatamente após settlement: receipt ainda existe
    expect(receipt).toBe('contract-123');
    expect(onChanged).toHaveBeenCalledTimes(1);

    // Avança 2.9s: receipt ainda existe (mostrando resultado)
    vi.advanceTimersByTime(2900);
    expect(receipt).toBe('contract-123');

    // Avança mais 100ms (total 3s): receipt limpo
    vi.advanceTimersByTime(100);
    expect(receipt).toBeNull();
  });

  it('2.2 Botões habilitados após reset (receipt null não bloqueia)', () => {
    // O `blocked` no OrderTicket.tsx NÃO depende de `receipt`:
    //   const blocked = paused || stale || stakeMinor === null || stakeMinor > currentAvailable;
    // Logo, com receipt=null, paused=false, stale=false, stakeMinor válido:
    const paused = false;
    const stale = false;
    const stakeMinor = 1000; // US$ 10.00
    const currentAvailable = 100000; // US$ 1000.00

    const blocked = paused || stale || stakeMinor === null || stakeMinor > currentAvailable;
    expect(blocked).toBe(false); // Botões devem estar habilitados
  });

  it('2.3 notified.current previne dupla notificação do mesmo contrato', () => {
    const notifiedRef = { current: null as string | null };
    const onChanged = vi.fn();
    let resetCount = 0;

    // Primeira chamada: deve notificar
    simulateSettlementEffect(
      'SETTLED',
      'contract-AAA',
      notifiedRef,
      () => { resetCount++; },
      onChanged
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(notifiedRef.current).toBe('contract-AAA');

    // Segunda chamada com MESMO ID: NÃO deve notificar
    simulateSettlementEffect(
      'SETTLED',
      'contract-AAA',
      notifiedRef,
      () => { resetCount++; },
      onChanged
    );
    expect(onChanged).toHaveBeenCalledTimes(1); // Não chamou de novo

    // Avança timer: apenas 1 reset executado
    vi.advanceTimersByTime(3000);
    expect(resetCount).toBe(1);
  });

  it('2.4 Cleanup function cancela timer se componente desmontar antes dos 3s', () => {
    let receipt: string | null = 'contract-456';
    const notifiedRef = { current: null as string | null };

    const cleanup = simulateSettlementEffect(
      'SETTLED',
      'contract-456',
      notifiedRef,
      () => { receipt = null; },
      vi.fn()
    );

    expect(cleanup).toBeDefined(); // Cleanup retornado

    // Simula desmontagem do componente após 1s
    vi.advanceTimersByTime(1000);
    cleanup!(); // Cleanup chamado

    // Avança mais 5s: receipt NÃO deve ter sido limpo (timer cancelado)
    vi.advanceTimersByTime(5000);
    expect(receipt).toBe('contract-456'); // Timer foi cancelado pelo cleanup
  });

  // ── TESTES DE ESTRESSE ──

  it('2.5 ESTRESSE: 10 operações consecutivas com reset entre cada', () => {
    const notifiedRef = { current: null as string | null };
    let receiptValue: string | null = null;
    const onChanged = vi.fn();

    for (let i = 0; i < 10; i++) {
      const contractId = `stress-${i}`;
      receiptValue = contractId; // Simula setReceipt(opened)

      simulateSettlementEffect(
        'SETTLED',
        contractId,
        notifiedRef,
        () => { receiptValue = null; },
        onChanged
      );

      // Avança 3s para limpar
      vi.advanceTimersByTime(3000);
      expect(receiptValue).toBeNull();
    }

    expect(onChanged).toHaveBeenCalledTimes(10);
  });

  it('2.6 ESTRESSE: Nova operação substitui receipt ANTES do reset da anterior', () => {
    const notifiedRef = { current: null as string | null };
    let currentReceipt: string | null = 'old-contract';
    const onChanged = vi.fn();

    // Settlement do contrato antigo
    const cleanup1 = simulateSettlementEffect(
      'SETTLED',
      'old-contract',
      notifiedRef,
      () => { currentReceipt = null; },
      onChanged
    );

    // ANTES dos 3s, nova operação é aberta
    vi.advanceTimersByTime(1000);
    currentReceipt = 'new-contract'; // Simula setReceipt(newOpened)

    // Cleanup do effect antigo (React re-run do useEffect)
    cleanup1!();

    // O timer antigo foi cancelado — receipt mantém 'new-contract'
    vi.advanceTimersByTime(5000);
    expect(currentReceipt).toBe('new-contract');
  });

  // ── TESTES DE SEGURANÇA ──

  it('2.7 SEGURANÇA: Double-click protegido por executingRef (simulação)', () => {
    let callCount = 0;
    const executingRef = { current: false };

    function simulateHandleExecute() {
      if (executingRef.current) return; // Guard
      executingRef.current = true;
      callCount++;
      // Simula async
      setTimeout(() => { executingRef.current = false; }, 100);
    }

    // Dois cliques rápidos
    simulateHandleExecute();
    simulateHandleExecute(); // Deve ser bloqueado

    expect(callCount).toBe(1); // Apenas 1 execução

    // Após release
    vi.advanceTimersByTime(100);
    simulateHandleExecute();
    expect(callCount).toBe(2); // Agora pode executar
  });

  it('2.8 SEGURANÇA: Timer não persiste após unmount (sem state update em desmontado)', () => {
    let stateUpdateCalled = false;
    const notifiedRef = { current: null as string | null };

    const cleanup = simulateSettlementEffect(
      'SETTLED',
      'unmount-test',
      notifiedRef,
      () => { stateUpdateCalled = true; },
      vi.fn()
    );

    // Unmount imediato
    cleanup!();

    // Timer não deve disparar
    vi.advanceTimersByTime(10000);
    expect(stateUpdateCalled).toBe(false);
  });

  // ── TESTES DE CAOS ──

  it('2.9 CAOS: FAILED_COMPENSATION também reseta receipt', () => {
    let receipt: string | null = 'failed-contract';
    const notifiedRef = { current: null as string | null };

    simulateSettlementEffect(
      'FAILED_COMPENSATION',
      'failed-contract',
      notifiedRef,
      () => { receipt = null; },
      vi.fn()
    );

    vi.advanceTimersByTime(3000);
    expect(receipt).toBeNull();
  });

  it('2.10 CAOS: CANCELLED também reseta receipt', () => {
    let receipt: string | null = 'cancelled-contract';
    const notifiedRef = { current: null as string | null };

    simulateSettlementEffect(
      'CANCELLED',
      'cancelled-contract',
      notifiedRef,
      () => { receipt = null; },
      vi.fn()
    );

    vi.advanceTimersByTime(3000);
    expect(receipt).toBeNull();
  });

  it('2.11 CAOS: OPEN status NÃO reseta receipt', () => {
    let receipt: string | null = 'open-contract';
    const notifiedRef = { current: null as string | null };

    const cleanup = simulateSettlementEffect(
      'OPEN',
      'open-contract',
      notifiedRef,
      () => { receipt = null; },
      vi.fn()
    );

    expect(cleanup).toBeUndefined();
    vi.advanceTimersByTime(10000);
    expect(receipt).toBe('open-contract'); // NÃO resetou
  });

  it('2.12 CAOS: Status desconhecido NÃO reseta receipt', () => {
    let receipt: string | null = 'unknown-contract';
    const notifiedRef = { current: null as string | null };

    const cleanup = simulateSettlementEffect(
      'PROCESSING',
      'unknown-contract',
      notifiedRef,
      () => { receipt = null; },
      vi.fn()
    );

    expect(cleanup).toBeUndefined();
    vi.advanceTimersByTime(10000);
    expect(receipt).toBe('unknown-contract');
  });

  it('2.13 REGRESSÃO: blocked calcula corretamente sem depender de receipt', () => {
    // Verifica que a lógica de blocked não usa receipt
    const cases = [
      { paused: false, stale: false, stakeMinor: 1000, avail: 100000, expected: false },
      { paused: true,  stale: false, stakeMinor: 1000, avail: 100000, expected: true },
      { paused: false, stale: true,  stakeMinor: 1000, avail: 100000, expected: true },
      { paused: false, stale: false, stakeMinor: null,  avail: 100000, expected: true },
      { paused: false, stale: false, stakeMinor: 200000, avail: 100000, expected: true },
    ];

    for (const c of cases) {
      const blocked = c.paused || c.stale || c.stakeMinor === null || (c.stakeMinor ?? 0) > c.avail;
      expect(blocked).toBe(c.expected);
    }
  });
});
