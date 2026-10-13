import { describe, it, expect } from 'vitest';
import esJson from '../i18n/locales/es-ES.json';

describe('Vocabulário Oficial em Espanhol LATAM Neutro (Etapa 09)', () => {
  it('Valida termos canônicos obrigatórios da Binmax Option', () => {
    // Proibido: Call, Put, Arriba, Abajo, Invest, Profit, Lucro, Expiry
    expect(esJson.trade.call).toBe('SUBE');
    expect(esJson.trade.put).toBe('BAJA');
    expect(esJson.trade.stake).toBe('Monto');
    expect(esJson.trade.profit).toBe('Ganancia');
    expect(esJson.trade.duration).toBe('Expiración');
    expect(esJson.app.deposit).toBe('Depositar');
    expect(esJson.app.demo_badge).toBe('Cuenta demo');
  });

  it('Valida microcopy oficial de toasts e mensagens de estado', () => {
    expect(esJson.trade.win_toast).toBe('¡Ganaste!');
    expect(esJson.trade.loss_toast).toBe('No esta vez');
    expect(esJson.trade.empty_portfolio).toBe(
      'Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.'
    );
    expect(esJson.trade.insufficient_balance).toBe(
      'Saldo insuficiente. Deposita y sigue operando.'
    );
  });
});
