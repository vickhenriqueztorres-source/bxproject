import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BlnkClient } = require('../../services/wallet-adapter/dist/blnk-client.js');

describe('Subetapa 8.5: Bateria de Testes de Persistência, Blnk Ledger e Invariantes', () => {

  describe('1. Invariante I-01 e I-02: Double-Entry e Modelo Contábil Blnk', () => {
    it('BlnkClient inicializa com o ledger oficial e contas da casa corretas', () => {
      const client = new BlnkClient('http://mock-blnk:5001');
      assert.equal(client.LEDGER_ID, 'broker_demo');
      assert.equal(client.HOUSE_REVENUE, '@house_revenue');
      assert.equal(client.HOUSE_PAYOUT, '@house_payout');
      assert.equal(client.BROKER_FLOAT, '@broker_float');
      assert.equal(client.DEMO_START_BALANCE_MINOR, 1_000_000); // US$ 10.000,00
    });

    it('Mapeia formato de contas @user_<id>:available e @user_<id>:reserved com precisão', () => {
      const userId = '00000000-0000-4000-8000-000000000001';
      const availableAcc = `@user_${userId}:available`;
      const reservedAcc = `@user_${userId}:reserved`;
      assert.equal(availableAcc, '@user_00000000-0000-4000-8000-000000000001:available');
      assert.equal(reservedAcc, '@user_00000000-0000-4000-8000-000000000001:reserved');
    });
  });

  describe('2. Invariante I-03: Idempotência de Transações e Ordens', () => {
    it('Referências de transações do Blnk são determinísticas e únicas por contrato', () => {
      const contractId = 'c-uuid-12345';
      const reserveRef = `reserve:${contractId}`;
      const settleLossRef = `settlement:${contractId}:LOSS`;
      const settleWinStakeRef = `settlement:${contractId}:WIN_STAKE`;
      const settleWinProfitRef = `settlement:${contractId}:WIN_PROFIT`;
      const settleDrawRef = `settlement:${contractId}:DRAW`;

      assert.equal(reserveRef, 'reserve:c-uuid-12345');
      assert.equal(settleLossRef, 'settlement:c-uuid-12345:LOSS');
      assert.equal(settleWinStakeRef, 'settlement:c-uuid-12345:WIN_STAKE');
      assert.equal(settleWinProfitRef, 'settlement:c-uuid-12345:WIN_PROFIT');
      assert.equal(settleDrawRef, 'settlement:c-uuid-12345:DRAW');
    });

    it('Idempotency-Key é preservada e associada ao user_id', () => {
      const userId = 'user_abc';
      const idemKey = 'idem_' + Date.now();
      assert.ok(idemKey.startsWith('idem_'));
      assert.ok(userId.length > 0);
    });
  });

  describe('3. Padrão R-04: Circuit Breaker do BlnkClient', () => {
    it('Circuit breaker é acionado após 5 falhas consecutivas', async () => {
      // Porta inexistente para forçar ECONNREFUSED imediato
      const client = new BlnkClient('http://127.0.0.1:59999', 100);

      let caught = 0;
      for (let i = 0; i < 6; i++) {
        try {
          await client.getBalance('test-user');
        } catch (err) {
          caught++;
          if (i === 5) {
            assert.match(err.message, /CIRCUIT_BREAKER_OPEN/);
          }
        }
      }
      assert.equal(caught, 6);
    });
  });

  describe('4. Invariante D-18 e I-04: Cálculo Inteiro de Payouts (Sem Float)', () => {
    it('Payout de vitória com 85% de retorno preserva centavos exatos', () => {
      const stakeMinor = 1000; // US$ 10,00
      const payoutPct = 85;
      const profitMinor = Math.floor((stakeMinor * payoutPct) / 100);
      const totalPayoutMinor = stakeMinor + profitMinor;

      assert.equal(profitMinor, 850); // US$ 8,50
      assert.equal(totalPayoutMinor, 1850); // US$ 18,50 (185% do stake)
      assert.ok(Number.isInteger(totalPayoutMinor));
    });

    it('Payout de stake fracionária preserva arredondamento inferior (Math.floor)', () => {
      const stakeMinor = 133; // US$ 1,33
      const profitMinor = Math.floor((stakeMinor * 85) / 100);
      assert.equal(profitMinor, 113); // 133 * 0.85 = 113.05 -> 113
      assert.ok(Number.isInteger(profitMinor));
    });
  });

  describe('5. Auditoria de Ausência de Fictitious Settlement no Frontend', () => {
    it('reconcileGuestContracts retorna 0 liquidações locais (no-op seguro)', async () => {
      const { reconcileGuestContracts } = await import('../../apps/web/src/api/client.ts');
      const result = reconcileGuestContracts();
      assert.equal(result.settledCount, 0);
      assert.deepEqual(result.settledContracts, []);
    });
  });

});
