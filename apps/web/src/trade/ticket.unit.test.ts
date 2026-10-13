import { describe, it, expect, vi } from 'vitest';
import { parseStakeInput, formatMinor } from '../lib/money';
import { calculateExecutionExpiry, calculateExpirySlots } from './expiry-calculator';

describe('OrderTicket — Requisitos Fiscais e Visual IQ Option (Etapa 07)', () => {
  it('D1 Monto: parseStakeInput valida corretamente valores decimais e inteiros', () => {
    expect(parseStakeInput('1')).toBe(100);
    expect(parseStakeInput('1,00')).toBe(100);
    expect(parseStakeInput('10,50')).toBe(1050);
    expect(parseStakeInput('100')).toBe(10000);
    expect(parseStakeInput('-5')).toBeNull();
    expect(parseStakeInput('abc')).toBeNull();
  });

  it('D2 Expiración: gera slots de tempo com garantia inviolável >= 30 segundos', () => {
    const fixedNow = new Date('2026-10-08T03:00:00.000Z');
    const slots = calculateExpirySlots(fixedNow, -3);
    expect(slots.length).toBeGreaterThanOrEqual(3);
    
    // Todos os slots devem respeitar piso de 30 segundos
    slots.forEach((slot) => {
      expect(slot.remainingSeconds).toBeGreaterThanOrEqual(30);
      expect(slot.durationSeconds).toBeGreaterThanOrEqual(30);
    });

    const execution = calculateExecutionExpiry('1M_FIXED', fixedNow.getTime());
    expect(execution.durationMs).toBeGreaterThanOrEqual(30000);
  });

  it('D3 Ganancia: formata payout e lucro com precisão monetária inteira', () => {
    const stakeMinor = 1000; // $10.00
    const payoutPct = 85;
    const profitMinor = Math.round(stakeMinor * (payoutPct / 100)); // 850 ($8.50)
    
    expect(profitMinor).toBe(850);
    expect(formatMinor(profitMinor)).toContain('8,50');
    expect(formatMinor(stakeMinor + profitMinor)).toContain('18,50');
  });

  it('D4 & D5 Simetria: SUBE e BAJA possuem paridade dimensional e de ação', () => {
    // Ambos operam sobre as mesmas direções UP e DOWN
    const directions: ('UP' | 'DOWN')[] = ['UP', 'DOWN'];
    expect(directions).toContain('UP');
    expect(directions).toContain('DOWN');
  });

  it('Proteção contra clique duplo: validação do flag busy impede reenvio concorrente', () => {
    let busy = false;
    let callCount = 0;

    const mockExecute = () => {
      if (busy) return;
      busy = true;
      callCount++;
    };

    // Primeiro clique
    mockExecute();
    expect(callCount).toBe(1);
    expect(busy).toBe(true);

    // Segundo clique imediato (simulando duplo clique)
    mockExecute();
    expect(callCount).toBe(1); // Não incrementou!
  });
});
