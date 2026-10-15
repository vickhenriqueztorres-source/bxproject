import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxDepositModal } from './BinmaxDepositModal';
import { BinmaxWithdrawModal } from './BinmaxWithdrawModal';

describe('SUBETAPA 03: Módulo Financeiro BINMAX (Depósito & Saque)', () => {
  it('3.1 BinmaxDepositModal: Renderiza os 3 métodos de depósito, chips de valor, resumo e bônus sutil', () => {
    const html = renderToString(
      <BinmaxDepositModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="binmax-deposit-modal"');
    expect(html).toContain('Depositar');
    expect(html).toContain('PIX');
    expect(html).toContain('Tarjeta');
    expect(html).toContain('Cripto (USDT)');
    expect(html).toContain('Mínimo $10');
    expect(html).toContain('$20');
    expect(html).toContain('$50');
    expect(html).toContain('$100');
    expect(html).toContain('$250');
    expect(html).toContain('$500');
    expect(html).toContain('Recibes');
    expect(html).toContain('Sin comisión');
    expect(html).toContain('Bono de bienvenida +30% aplicado');
    expect(html).toContain('Continuar');
    expect(html).toContain('Pagos procesados por proveedor seguro');
  });

  it('3.2 BinmaxDepositModal: Não renderiza quando isOpen é falso', () => {
    const html = renderToString(
      <BinmaxDepositModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('[D-UI-00B] 3.3: preserva métodos, mínimo, saldo informado, KYC e histórico indisponível na simulação', () => {
    const html = renderToString(
      <BinmaxWithdrawModal
        isOpen={true}
        onClose={vi.fn()}
        availableBalanceFormatted="$10,000.00"
      />
    );

    expect(html).toContain('data-testid="binmax-withdraw-modal"');
    expect(html).toContain('Retirar');
    expect(html).toContain('Saldo disponible');
    expect(html).toContain('$10,000.00');
    expect(html).toContain('Banco');
    expect(html).toContain('PIX');
    expect(html).toContain('Cripto');
    expect(html).toContain('Mínimo de retiro: $50.00');
    expect(html).toContain('Clave PIX (CPF, Email, Teléfono o Aleatoria)');
    expect(html).toContain('Primer retiro requiere verificación de identidad');
    expect(html).toContain('Simular solicitud');
    expect(html).toContain('Último retiro');
    expect(html).toContain('No disponible en esta demostración');
    expect(html).toContain('Cuenta demo');
    expect(html).toContain('No se enviarán fondos');
    expect(html).toContain('min="50"');
    expect(html).toContain('required=""');
    expect(html).not.toContain('En revisión');
    expect(html).not.toContain('100% tuyas');
  });

  it('[D-UI-00B] não inventa saldo quando o consumidor não informa um valor', () => {
    const html = renderToString(<BinmaxWithdrawModal isOpen={true} onClose={vi.fn()} />);
    expect(html).toContain('No disponible en esta demostración');
    expect(html).not.toContain('$10,085.00');
  });

  it('[D-UI-00B] renderizar não executa callback nem interpreta saldo hostil como HTML', () => {
    const onWithdrawRequested = vi.fn();
    const html = renderToString(<BinmaxWithdrawModal isOpen={true} onClose={vi.fn()}
      availableBalanceFormatted={'<script>alert(1)</script>'} onWithdrawRequested={onWithdrawRequested} />);
    expect(onWithdrawRequested).not.toHaveBeenCalled();
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('[Subetapa 7.5] exibe PIX apenas para o Brasil (BR) e Transferencia para outros paises (MX, AR, CO)', () => {
    const htmlBR = renderToString(
      <BinmaxDepositModal isOpen={true} onClose={vi.fn()} country="BR" />
    );
    expect(htmlBR).toContain('data-testid="deposit-method-pix"');
    expect(htmlBR).toContain('PIX');

    for (const country of ['MX', 'AR', 'CO']) {
      const htmlOther = renderToString(
        <BinmaxDepositModal isOpen={true} onClose={vi.fn()} country={country} />
      );
      expect(htmlOther).not.toContain('data-testid="deposit-method-pix"');
      expect(htmlOther).toContain('data-testid="deposit-method-bank"');
      expect(htmlOther).toContain('Transferencia');
    }
  });
});

