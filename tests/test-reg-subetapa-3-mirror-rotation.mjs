import assert from 'node:assert';
import { MirrorDomainService } from '../services/api/dist/services/mirror-domains.js';

console.log('🧪 Iniciando Verificação de Quality Gate - Subetapa 3: Rede de Domínios Espelho & Rotação Resiliente a Censura DNS');

// Mock em memória para testar lógica transacional do MirrorDomainService
const mockDB = {
  mirrors: [
    { id: '1', domain_name: 'app.nomedominio-br1.com', target_country: 'BR', status: 'ACTIVE', priority: 10, latency_ms: 15, last_health_check_at: new Date() },
    { id: '2', domain_name: 'app.nomedominio-br2.com', target_country: 'BR', status: 'STANDBY', priority: 20, latency_ms: 18, last_health_check_at: new Date() },
    { id: '3', domain_name: 'app.nomedominio-in.com', target_country: 'IN', status: 'ACTIVE', priority: 10, latency_ms: 45, last_health_check_at: new Date() },
    { id: '4', domain_name: 'app.nomedominio-in2.com', target_country: 'IN', status: 'STANDBY', priority: 20, latency_ms: 50, last_health_check_at: new Date() },
    { id: '5', domain_name: 'app.nomedominio-global.com', target_country: null, status: 'ACTIVE', priority: 10, latency_ms: 30, last_health_check_at: new Date() }
  ]
};

const publishedEvents = [];
const mockRedis = {
  get: async (key) => null,
  set: async (key, val) => 'OK',
  del: async (key) => 1,
  publish: async (channel, message) => {
    publishedEvents.push({ channel, message: JSON.parse(message) });
    return 1;
  }
};

const mockPg = {
  connect: async () => {
    return {
      query: async (sql, params) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
          return { rows: [] };
        }
        if (sql.includes('UPDATE mirror_domains') && sql.includes("status = 'BLOCKED'")) {
          const domain = params[0];
          const found = mockDB.mirrors.find(m => m.domain_name === domain);
          if (found) found.status = 'BLOCKED';
          return { rows: [{ target_country: found?.target_country }] };
        }
        if (sql.includes('SELECT id, domain_name') && sql.includes("status = 'STANDBY'")) {
          const country = params[0];
          const candidates = mockDB.mirrors.filter(m => m.status === 'STANDBY' && (m.target_country === country || m.target_country === null));
          candidates.sort((a, b) => a.priority - b.priority);
          return { rows: candidates.length > 0 ? [candidates[0]] : [] };
        }
        if (sql.includes('UPDATE mirror_domains') && sql.includes("status = 'ACTIVE'")) {
          const domain = params[0];
          const found = mockDB.mirrors.find(m => m.domain_name === domain);
          if (found) found.status = 'ACTIVE';
          return { rows: [found] };
        }
        return { rows: [] };
      },
      release: () => {}
    };
  },
  query: async (sql, params) => {
    if (sql.includes('SELECT') && sql.includes("target_country = $1 AND status = 'ACTIVE'")) {
      const country = params[0];
      const match = mockDB.mirrors.find(m => m.target_country === country && m.status === 'ACTIVE');
      return { rows: match ? [match] : [] };
    }
    if (sql.includes('SELECT') && sql.includes("target_country IS NULL AND status = 'ACTIVE'")) {
      const match = mockDB.mirrors.find(m => m.target_country === null && m.status === 'ACTIVE');
      return { rows: match ? [match] : [] };
    }
    if (sql.includes('SELECT') && sql.includes('FROM mirror_domains')) {
      return { rows: [...mockDB.mirrors] };
    }
    if (sql.includes('UPDATE mirror_domains') && sql.includes('latency_ms = $1')) {
      const lat = params[0];
      const dom = params[1];
      const found = mockDB.mirrors.find(m => m.domain_name === dom);
      if (found) found.latency_ms = lat;
      return { rows: [found] };
    }
    return { rows: [] };
  }
};

const service = new MirrorDomainService(mockPg, mockRedis);

// 1. Verificação de Consulta de Espelho Inicial Ativo
const initialActiveBR = await service.getActiveMirror('BR');
assert(initialActiveBR, 'Deve existir espelho ativo para o Brasil');
assert.strictEqual(initialActiveBR.domain_name, 'app.nomedominio-br1.com');
assert.strictEqual(initialActiveBR.status, 'ACTIVE');
console.log('  ✅ [PASS] Consulta do espelho ativo primário do Brasil validada (app.nomedominio-br1.com)');

// 2. Simulação de Bloqueio DNS por Teles / Anatel e Rotação Atômica
const rotateRes = await service.rotateDomain('app.nomedominio-br1.com', 'BR');
assert.strictEqual(rotateRes.previousDomain, 'app.nomedominio-br1.com');
assert.strictEqual(rotateRes.currentDomain, 'app.nomedominio-br2.com');
assert.strictEqual(rotateRes.targetCountry, 'BR');
console.log('  ✅ [PASS] Rotação atômica executada com sucesso: br1 marcado como BLOCKED e br2 promovido a ACTIVE');

// 3. Verificação do Novo Espelho Ativo
const newActiveBR = await service.getActiveMirror('BR');
assert.strictEqual(newActiveBR.domain_name, 'app.nomedominio-br2.com', 'Novo espelho ativo deve ser o br2');
assert.strictEqual(newActiveBR.status, 'ACTIVE');
console.log('  ✅ [PASS] Roteamento atualizado reflete o novo domínio espelho br2');

// 4. Verificação do Evento Pub/Sub para outros nós da rede
assert.strictEqual(publishedEvents.length, 1, 'Deve ter publicado 1 evento de rotação');
assert.strictEqual(publishedEvents[0].channel, 'system:domain_rotated');
assert.strictEqual(publishedEvents[0].message.event, 'DOMAIN_ROTATED');
assert.strictEqual(publishedEvents[0].message.previousDomain, 'app.nomedominio-br1.com');
assert.strictEqual(publishedEvents[0].message.currentDomain, 'app.nomedominio-br2.com');
console.log('  ✅ [PASS] Evento de rotação publicado com sucesso no Redis Pub/Sub para nós distribuídos');

// 5. Verificação de Atualização de Métrica de Latência e Health-check
await service.registerHealthCheck('app.nomedominio-br2.com', 12);
const updatedBr2 = mockDB.mirrors.find(m => m.domain_name === 'app.nomedominio-br2.com');
assert.strictEqual(updatedBr2.latency_ms, 12, 'Latência deve ser atualizada para 12ms');
console.log('  ✅ [PASS] Health-check e métricas de telemetria de latência atualizadas');

console.log('\n===============================================================');
console.log('🎉 QUALITY GATE 3 (GATE-REG-03) HOMOLOGADO COM 100% DE SUCESSO!');
console.log('===============================================================\n');
