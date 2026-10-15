import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createWalletReadEngine } from '../scripts/lib/wallet-read-engine.mjs';

test('Subetapa 3.1 (Estresse 500 Usuários): elimina Write-Amplification (UPDATE users) e reduz chamadas ao Blnk em >85%', async () => {
  const balancesInBlnk = new Map();
  for (let i = 1; i <= 500; i++) {
    balancesInBlnk.set(`user-${i}`, 1000000 + i * 100);
  }

  let blnkGetCalls = 0;
  let pgUpdateCalls = 0;

  const mockBlnk = {
    async getBalance(userId) {
      blnkGetCalls += 1;
      return {
        available_minor: balancesInBlnk.get(userId) ?? 1000000,
        reserved_minor: 0,
      };
    },
  };

  const mockPgPool = {
    async query(sql) {
      if (sql.trim().toUpperCase().startsWith('UPDATE USERS')) {
        pgUpdateCalls += 1;
      }
      return { rows: [], rowCount: 1 };
    },
  };

  const engine = createWalletReadEngine({
    blnk: mockBlnk,
    pgPool: mockPgPool,
    memoryUsers: new Map(),
    getDevWallet: () => ({ currency: 'USD', available_minor: 1000000, reserved_minor: 0 }),
    ttlMs: 5000,
  });

  const t0 = 1_700_000_000_000;

  // Rodada 1 (t0): 500 usuários abrem a sala simultaneamente (Cache Miss inicial)
  await Promise.all(
    Array.from({ length: 500 }, (_, idx) =>
      engine.resolveUserWallet({ sub: `user-${idx + 1}` }, t0)
    )
  );
  assert.equal(blnkGetCalls, 500, 'Primeira leitura de cada um dos 500 usuários consulta o Blnk');
  assert.equal(pgUpdateCalls, 500, 'Primeira leitura sincroniza o saldo inicial no Postgres');

  // Rodadas 2 a 10 dentro da janela de 5s (4.500 requisições concorrentes): 0 chamadas ao Blnk e 0 UPDATEs no Postgres!
  for (let round = 1; round <= 9; round++) {
    await Promise.all(
      Array.from({ length: 500 }, (_, idx) =>
        engine.resolveUserWallet({ sub: `user-${idx + 1}` }, t0 + round * 500)
      )
    );
  }

  assert.equal(
    blnkGetCalls,
    500,
    'As 4.500 leituras subsequentes dentro do TTL devem gerar ZERO chamadas ao Blnk (90% de redução total)'
  );
  assert.equal(
    pgUpdateCalls,
    500,
    'As 4.500 leituras em cache não devem gerar nenhum UPDATE no PostgreSQL'
  );

  // Rodada 11 após expiração do TTL (t0 + 6000ms): cache expira, consulta Blnk, mas como o saldo NÃO mudou,
  // ZERO UPDATEs são executados no PostgreSQL (eliminação de 100% do Write-Amplification em repouso)!
  await Promise.all(
    Array.from({ length: 500 }, (_, idx) =>
      engine.resolveUserWallet({ sub: `user-${idx + 1}` }, t0 + 6000)
    )
  );

  assert.equal(blnkGetCalls, 1000, 'Após expirar o TTL de 5s, consulta o Blnk novamente');
  assert.equal(
    pgUpdateCalls,
    500,
    'CRÍTICO: Mesmo após expirar o cache, como o saldo não mudou, ZERO UPDATEs adicionais devem ocorrer no PostgreSQL!'
  );
  assert.equal(
    engine.telemetry.dbRedundantUpdatesSkippedTotal,
    500,
    'Todos os 500 UPDATEs redundantes foram bloqueados com sucesso'
  );
});

test('Subetapa 3.2 (Consistência Read-After-Write): invalidação imediata ao abrir/liquidar contrato sem saldo defasado', async () => {
  let currentBlnkAvailable = 1000000;
  let pgUpdateCount = 0;

  const engine = createWalletReadEngine({
    blnk: {
      async getBalance() {
        return { available_minor: currentBlnkAvailable, reserved_minor: 0 };
      },
    },
    pgPool: {
      async query(sql) {
        if (sql.includes('UPDATE users')) pgUpdateCount += 1;
        return { rows: [], rowCount: 1 };
      },
    },
    ttlMs: 5000,
  });

  const userAuth = { sub: 'trader-alpha-01' };
  const t0 = 1_700_000_000_000;

  // 1. Leitura inicial: $10.000,00 (1000000 minor)
  const w1 = await engine.resolveUserWallet(userAuth, t0);
  assert.equal(w1.available_minor, 1000000);
  assert.equal(pgUpdateCount, 1);

  // 2. Apenas 20ms depois (dentro do TTL de 5000ms), o trader abre um contrato de $100,00 (10000 minor).
  // A rota POST /contracts deduz no Postgres para 990000 e invalida o cache informando o novo saldo sincronizado:
  currentBlnkAvailable = 990000;
  engine.invalidateUserWallet('trader-alpha-01', 990000);

  // 3. Leitura imediata em t0 + 25ms deve refletir 990000 (NUNCA o valor antigo em cache)
  // e não deve disparar outro UPDATE no Postgres pois 990000 já foi sincronizado!
  const w2 = await engine.resolveUserWallet(userAuth, t0 + 25);
  assert.equal(w2.available_minor, 990000, 'Read-after-write deve retornar o saldo atualizado imediatamente');
  assert.equal(pgUpdateCount, 1, 'Não deve executar UPDATE duplicado quando a rota mutadora já atualizou o banco');
});

test('Subetapa 3.3 (Segurança BOLA / S-03): isolamento absoluto de cache entre diferentes usuários e modo convidado', async () => {
  const engine = createWalletReadEngine({
    blnk: {
      async getBalance(userId) {
        if (userId === 'victim-user') return { available_minor: 9500000, reserved_minor: 50000 };
        if (userId === 'attacker-user') return { available_minor: 12000, reserved_minor: 0 };
        throw new Error('Unknown user');
      },
    },
    pgPool: null,
    getDevWallet: () => ({ currency: 'USD', available_minor: 1000000, reserved_minor: 0 }),
    ttlMs: 5000,
  });

  const t0 = 1_700_000_000_000;
  const [victimWallet, attackerWallet, guestWallet] = await Promise.all([
    engine.resolveUserWallet({ sub: 'victim-user' }, t0),
    engine.resolveUserWallet({ sub: 'attacker-user' }, t0),
    engine.resolveUserWallet(null, t0),
  ]);

  assert.equal(victimWallet.available_minor, 9500000);
  assert.equal(victimWallet.reserved_minor, 50000);
  assert.equal(attackerWallet.available_minor, 12000);
  assert.equal(attackerWallet.reserved_minor, 0);
  assert.equal(guestWallet.available_minor, 1000000);

  // Mutação na carteira do atacante jamais deve afetar o cache da vítima
  attackerWallet.available_minor = 999999999;
  const attackerCachedAgain = await engine.resolveUserWallet({ sub: 'attacker-user' }, t0 + 100);
  assert.equal(
    attackerCachedAgain.available_minor,
    12000,
    'Mutação do objeto retornado não deve corromper a referência interna do cache'
  );
});

test('Subetapa 3.4 (Inspeção de Integração App.tsx): polling relaxado para 15s mantendo push WebSocket em tempo real', () => {
  const appTsxPath = path.resolve(process.cwd(), 'apps/web/src/App.tsx');
  const content = fs.readFileSync(appTsxPath, 'utf8');

  assert.ok(
    content.includes("queryKey: ['contracts']") && content.includes('refetchInterval: 15_000'),
    'App.tsx deve usar refetchInterval: 15_000 para contracts'
  );
  assert.ok(
    content.includes("queryKey: ['wallet']") && content.includes('refetchInterval: 15_000'),
    'App.tsx deve usar refetchInterval: 15_000 para wallet'
  );
  assert.ok(
    content.includes("event.type === 'wallet_balance'") && content.includes("event.type === 'contract_settled'"),
    'App.tsx deve preservar os handlers de push em tempo real via WebSocket'
  );
});
