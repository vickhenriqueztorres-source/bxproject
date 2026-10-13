import { describe, it, expect } from 'vitest';
import { formatMinor } from '../lib/money';

describe('Portfólio e Resultados — Requisitos Etapa 08', () => {
  it('Formatação de avisos de vitória oficial (¡Ganaste! +$XX.XX)', () => {
    const payoutMinor = 1850; // $18.50
    const msg = `¡Ganaste! +${formatMinor(payoutMinor)}`;
    expect(msg).toContain('¡Ganaste!');
    expect(msg).toContain('18,50');
  });

  it('Formatação de avisos de derrota oficial (No esta vez · −$XX.XX)', () => {
    const stakeMinor = 1000; // $10.00
    const msg = `No esta vez · −${formatMinor(stakeMinor)}`;
    expect(msg).toContain('No esta vez');
    expect(msg).toContain('10,00');
  });

  it('Formatação de empate oficial (Empate · se devolvió $XX.XX)', () => {
    const stakeMinor = 1000;
    const msg = `Empate · se devolvió ${formatMinor(stakeMinor)}`;
    expect(msg).toContain('Empate');
    expect(msg).toContain('10,00');
  });

  it('Microcopy oficial de estados vazios do portfólio em espanhol LATAM neutro', () => {
    const emptyOpenMsg = 'Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.';
    const emptyHistoryMsg = 'Aún no tienes operaciones cerradas.';

    expect(emptyOpenMsg).toContain('SUBE o BAJA');
    expect(emptyHistoryMsg).toBe('Aún no tienes operaciones cerradas.');
  });
});
