import { describe, it, expect } from 'vitest';
import { normalizeContractFields, type Contract } from '../../apps/web/src/api/client';
import { resolveContractClosingPrice, generateCsvContent } from '../../apps/web/src/pages/HistoryPage';
import { groupOpenContracts } from '../../apps/web/src/chart/OrderFlagsOverlay';

describe('Subetapa 12.1 — Frontend: Semântica exit_price vs entry_price, Histórico e Flags', () => {
  it('1. normalizeContractFields: preserva strike_price === entry_price e recupera exit_price de cache legado', () => {
    const openContract: Contract = {
      id: 'c-open-1',
      symbol: 'R_100',
      direction: 'UP',
      stake_minor: 1000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: '2026-10-15T20:00:00Z',
      created_at: '2026-10-15T19:59:00Z',
      entry_price: 500.25,
      strike_price: 500.25,
      exit_price: 500.25, // mesmo que venha sujo no cache, contrato OPEN tem exit_price = null
    };

    const normOpen = normalizeContractFields(openContract);
    expect(normOpen.entry_price).toBe(500.25);
    expect(normOpen.strike_price).toBe(500.25);
    expect(normOpen.exit_price).toBeNull();

    // Contrato legado salvo antes do #12 (onde strike_price guardava a saída e exit_price não estava presente)
    const legacySettled: Contract = {
      id: 'c-legacy-settled',
      symbol: 'R_100',
      direction: 'UP',
      stake_minor: 1000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 1850,
      expires_at: '2026-10-15T20:00:00Z',
      created_at: '2026-10-15T19:59:00Z',
      entry_price: 500.0,
      strike_price: 504.75,
    };

    const normLegacy = normalizeContractFields(legacySettled);
    expect(normLegacy.entry_price).toBe(500.0);
    expect(normLegacy.strike_price).toBe(500.0);
    expect(normLegacy.exit_price).toBe(504.75);

    // Contrato novo pós-#12 (onde strike_price === entry_price e exit_price traz a saída real)
    const canonicalSettled: Contract = {
      id: 'c-canonical-settled',
      symbol: 'R_100',
      direction: 'DOWN',
      stake_minor: 2000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 3700,
      expires_at: '2026-10-15T20:00:00Z',
      created_at: '2026-10-15T19:59:00Z',
      entry_price: 500.0,
      strike_price: 500.0,
      exit_price: 498.12,
    };

    const normCanonical = normalizeContractFields(canonicalSettled);
    expect(normCanonical.entry_price).toBe(500.0);
    expect(normCanonical.strike_price).toBe(500.0);
    expect(normCanonical.exit_price).toBe(498.12);
  });

  it('2. HistoryPage (resolveContractClosingPrice + CSV): contrato OPEN mostra "—" em Cierre; SETTLED mostra exit_price', () => {
    const openC: Contract = {
      id: 'open-123',
      symbol: 'R_100',
      direction: 'UP',
      stake_minor: 1000,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: '2026-10-15T20:00:00Z',
      created_at: '2026-10-15T19:59:00Z',
      entry_price: 512.34,
      strike_price: 512.34,
      exit_price: null,
    };

    const settledC: Contract = {
      id: 'settled-456',
      symbol: 'R_100',
      direction: 'UP',
      stake_minor: 1000,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 1850,
      expires_at: '2026-10-15T20:00:00Z',
      created_at: '2026-10-15T19:59:00Z',
      entry_price: 512.34,
      strike_price: 512.34, // strike_price === entry_price (novo contrato de API)
      exit_price: 515.89,
    };

    expect(resolveContractClosingPrice(openC)).toBeNull();
    expect(resolveContractClosingPrice(settledC)).toBe(515.89);

    const csv = generateCsvContent([openC, settledC]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    // Linha do contrato OPEN deve ter 512.34 na abertura e — no fechamento (nunca 512.34 duas vezes!)
    expect(lines[1]).toContain(',512.34,—,PENDIENTE,');
    // Linha do contrato SETTLED deve ter 512.34 na abertura e 515.89 no fechamento
    expect(lines[2]).toContain(',512.34,515.89,WIN,');
  });

  it('3. OrderFlagsOverlay (groupOpenContracts): prioriza entry_price sobre strike_price', () => {
    const nowMs = Date.parse('2026-10-15T19:59:30Z');
    const groups = groupOpenContracts(
      [
        {
          id: 'flag-1',
          symbol: 'R_100',
          direction: 'UP',
          stake_minor: 1000,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          expires_at: '2026-10-15T20:00:00Z',
          created_at: '2026-10-15T19:59:00Z',
          entry_price: 501.25,
          strike_price: 999.99, // mesmo se strike_price estivesse corrompido, usa entry_price
        },
      ],
      502.0,
      nowMs
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].strike).toBe(501.25);
    expect(groups[0].isWinning).toBe(true);
  });
});
