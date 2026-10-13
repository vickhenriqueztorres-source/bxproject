import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { BlnkClient } from '../../services/wallet-adapter/src/blnk-client.ts';

let server;
let client;
let accountCalls = 0;
let transactionCalls = 0;

before(async () => {
  server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/ledgers') {
      response.writeHead(201);
      response.end('{"ledger_id":"ldg_test"}');
    } else if (request.url === '/accounts') {
      accountCalls += 1;
      response.writeHead(400);
      response.end('{"error":"identity_id required"}');
    } else if (request.url === '/transactions') {
      transactionCalls += 1;
      response.writeHead(201);
      response.end('{"status":"QUEUED"}');
    } else {
      response.writeHead(404);
      response.end('{}');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  client = new BlnkClient(`http://127.0.0.1:${server.address().port}`);
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('[I-01] inicialização falha diante de conta rejeitada pelo Blnk', async () => {
  await assert.rejects(client.initializeLedgerAndHouseAccounts(), /BLNK_CLIENT_ERROR_400/);
  assert.equal(accountCalls, 1, 'Erro permanente não deve ser reenviado');
  assert.equal(transactionCalls, 0);
});

test('[I-01] onboarding rejeitado não envia crédito inicial', async () => {
  await assert.rejects(client.onboardUser(randomUUID()), /BLNK_CLIENT_ERROR_400/);
  assert.equal(accountCalls, 2);
  assert.equal(transactionCalls, 0);
});

test('[R-02] erro 400 permanente não abre o circuito em tentativas independentes', async () => {
  const isolated = new BlnkClient(`http://127.0.0.1:${server.address().port}`);
  const beforeCalls = accountCalls;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await assert.rejects(isolated.onboardUser(randomUUID()), /BLNK_CLIENT_ERROR_400/);
  }
  assert.equal(accountCalls - beforeCalls, 6);
  assert.equal(transactionCalls, 0);
});
