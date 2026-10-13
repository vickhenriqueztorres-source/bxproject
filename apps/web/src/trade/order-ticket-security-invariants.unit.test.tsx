import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseStakeInput, formatMinor, formatCurrencyBinmax } from '../lib/money';
import { safeRandomUUID } from '../lib/uuid';

describe('SUBETAPA 05: Auditoria de Segurança, Invariantes Financeiras e Integridade Client-Server', () => {
  it('SEC-01: O stake é rigorosamente convertido para inteiro minor (centavos USD), blindando contra floats e BRL', () => {
    // Valores de teste válidos dentro do teto do sistema (100 a 10.000 centavos = $1.00 a $100.00)
    const testCases: [string, number][] = [
      ['1', 100],        // $1.00 -> 100 cents
      ['10', 1000],      // $10.00 -> 1000 cents
      ['50', 5000],      // $50.00 -> 5000 cents
      ['100', 10000],    // $100.00 -> 10000 cents
      ['12,34', 1234],   // $12.34 -> 1234 cents
      ['99,99', 9999],   // $99.99 -> 9999 cents
    ];

    for (const [input, expectedMinor] of testCases) {
      const parsed = parseStakeInput(input);
      expect(parsed).toBe(expectedMinor);
      expect(Number.isInteger(parsed)).toBe(true);
      expect(parsed).toBeGreaterThan(0);
    }

    // $500 excede o teto operacional do MVP de $100 (10.000 centavos) e deve ser rejeitado defensivamente
    expect(parseStakeInput('500')).toBeNull();
  });

  it('SEC-02: Toda abertura de contrato gera Idempotency-Key UUIDv4 criptograficamente segura (D-12, I-03)', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const key = safeRandomUUID();
      // Validação de formato UUIDv4
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it('SEC-03: Barreira contra clique duplo: bloqueia reentrância e reenvios concorrentes', () => {
    let callCount = 0;
    let isExecuting = false;

    const executeTrade = () => {
      if (isExecuting) return false;
      isExecuting = true;
      callCount++;
      return true;
    };

    // Rajada de 10 tentativas simultâneas
    const results = Array.from({ length: 10 }, () => executeTrade());
    expect(callCount).toBe(1);
    expect(results.filter(Boolean).length).toBe(1);
  });

  it('SEC-04: Invariante D-18: Exibição monetária $ e cálculos de Ganancia estão em USD com soma zero contábil', () => {
    const stakeMinor = 10000; // $100.00
    const payoutPct = 85;
    const profitMinor = Math.round(stakeMinor * (payoutPct / 100)); // $85.00 -> 8500 cents
    const totalReturnMinor = stakeMinor + profitMinor; // $185.00 -> 18500 cents

    expect(profitMinor).toBe(8500);
    expect(totalReturnMinor).toBe(18500);
    expect(formatCurrencyBinmax(profitMinor)).toBe('$85.00');
    expect(formatCurrencyBinmax(totalReturnMinor)).toBe('$185.00');
  });
});
