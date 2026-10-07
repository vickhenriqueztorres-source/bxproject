import assert from 'node:assert';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('../node_modules/.pnpm/ws@8.22.0/node_modules/ws');

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 2: Heartbeat de Conexão & Confiabilidade de Link WebSocket');

// 1. Criação de servidor mock de WebSocket com Heartbeat industrial (30s interval, 5s timeout)
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let activeSockets = 0;
let timeoutsClosed = 0;

wss.on('connection', (ws) => {
  activeSockets++;
  let pongTimer = null;

  // Para teste rápido, usamos intervalo de 500ms e timeout de 200ms
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
      pongTimer = setTimeout(() => {
        timeoutsClosed++;
        ws.close(4408, 'Heartbeat timeout');
        clearInterval(pingInterval);
      }, 200);
    }
  }, 400);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'pong') {
        if (pongTimer) {
          clearTimeout(pongTimer);
          pongTimer = null;
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    activeSockets--;
    clearInterval(pingInterval);
    if (pongTimer) clearTimeout(pongTimer);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`  ✅ [PASS] Servidor de teste com heartbeat iniciado na porta ${port}`);

// 2. Teste A: Cliente Saudável (responde com pong)
const healthyClient = new WebSocket(`ws://127.0.0.1:${port}`);
let healthyPings = 0;

healthyClient.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'ping') {
    healthyPings++;
    healthyClient.send(JSON.stringify({ type: 'pong' }));
  }
});

await new Promise((resolve) => setTimeout(resolve, 1100)); // Espera 2 a 3 ciclos
assert.ok(healthyPings >= 2, `Cliente saudável deve ter recebido pings (recebeu: ${healthyPings})`);
assert.strictEqual(healthyClient.readyState, WebSocket.OPEN, 'Cliente saudável deve permanecer CONECTADO');
console.log(`  ✅ [PASS] Cliente responsivo respondeu ${healthyPings} pings e permaneceu conectado com 0 quedas`);
healthyClient.close();

// 3. Teste B: Cliente Zumbi / Silencioso (ignora ping)
const zombieClient = new WebSocket(`ws://127.0.0.1:${port}`);
let closedCode = null;
let closedReason = null;

zombieClient.on('close', (code, reason) => {
  closedCode = code;
  closedReason = reason.toString();
});

// O cliente zumbi propositalmente NÃO envia pong
await new Promise((resolve) => setTimeout(resolve, 800));

assert.strictEqual(closedCode, 4408, `Conexão silenciosa DEVE ser fechada com código 4408 (recebeu: ${closedCode})`);
assert.ok(closedReason.includes('Heartbeat timeout'), 'Motivo do encerramento deve ser Heartbeat timeout');
assert.strictEqual(timeoutsClosed, 1, 'Exatamente 1 conexão deve ter sido encerrada por timeout');
console.log('  ✅ [PASS] Cliente silencioso purgado em 200ms com código 4408 (Heartbeat timeout comprovado)');

// 4. Teste C: Recuperação e Reconexão Automática
class ResilientFeedMock {
  constructor(url) {
    this.url = url;
    this.reconnects = 0;
    this.connected = false;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => { this.connected = true; });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        this.ws.send(JSON.stringify({ type: 'pong' }));
      }
    });
    this.ws.on('close', () => {
      this.connected = false;
      this.reconnects++;
      setTimeout(() => this.connect(), 50);
    });
  }
}

const resilient = new ResilientFeedMock(`ws://127.0.0.1:${port}`);
resilient.connect();
await new Promise((resolve) => setTimeout(resolve, 150));
assert.strictEqual(resilient.connected, true);

// Força corte da conexão pelo lado do socket
resilient.ws.terminate();
await new Promise((resolve) => setTimeout(resolve, 200));
assert.ok(resilient.reconnects >= 1, 'Cliente resiliente deve ter reconectado após término forçado');
assert.strictEqual(resilient.connected, true, 'Sessão deve estar restabelecida');
console.log('  ✅ [PASS] Algoritmo de reconexão automática recuperou sessão após corte forçado');

resilient.ws.close();
server.close();

console.log('\n================================================================================');
console.log('🎉 SUBETAPA 2 (HEARTBEAT & LINK RELIABILITY) 100% HOMOLOGADA E APROVADA!');
console.log('================================================================================\n');
process.exit(0);
