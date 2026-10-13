import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExpiryDropdown } from './ExpiryDropdown';

describe('SUBETAPA 02 — Frontend Visual: ExpiryDropdown Refinement', () => {
  it('renderiza o componente com tokens institucionais e sem nenhum caractere de emoji', () => {
    const html = renderToString(
      <ExpiryDropdown
        selectedSlotId="turbo_1m"
        onSelectSlot={vi.fn()}
        timeZoneOffsetHours={-3}
      />
    );

    // Verifica presença de tokens
    expect(html).toContain('TIEMPO DE EXPIRACIÓN');
    expect(html).toContain('#101622');
    expect(html).toContain('tabular-nums');

    // Verifica ausência absoluta de emojis
    expect(html).not.toContain('🕒');
    expect(html).not.toContain('▲');
    expect(html).not.toContain('▼');
  });

  it('exibe o rótulo do slot ativo corretamente', () => {
    const html = renderToString(
      <ExpiryDropdown
        selectedSlotId="candle_1m"
        onSelectSlot={vi.fn()}
        timeZoneOffsetHours={-3}
      />
    );

    expect(html).toContain('Fim da Vela 1M');
    expect(html).toContain('data-testid="expiry-dropdown-trigger"');
  });
});
