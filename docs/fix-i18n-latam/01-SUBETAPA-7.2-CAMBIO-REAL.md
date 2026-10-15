# Subetapa 1 — 7.2: Câmbio Real (ALTO PRIORIDADE)

**Branch**: `fix/i18n-latam`  
**Prioridade**: 🔴 ALTO  
**Estimativa**: 3-4 horas  
**Dependências**: Nenhuma (subetapa base)

---

## 0. Problema Atual

### 0.1 Sintomas
```javascript
// apps/web/src/i18n/index.tsx:361-366
const EXCHANGE_RATES = {
  BRL: 5.50,   // ❌ Taxa fixa desde quando?
  MXN: 19.50,  // ❌ Taxa fixa
  COP: 4150,   // ❌ Taxa fixa
  ARS: 980,    // ❌ CRÍTICO: Taxa real já > 1.000 (inflação)
  CLP: 940,    // ❌ Taxa fixa
  PEN: 3.75    // ❌ Taxa fixa
}
```

**Impacto**:
- Usuário argentino vê saldo **20% menor** que o real (980 vs 1.050)
- Desconfiança na plataforma ("meu saldo sumiu?")
- Impossível expandir países sem taxas reais

### 0.2 Infraestrutura Existente (Parada)
✅ **Migration 0020**: Tabela `display_currencies` existe  
✅ **Service**: `services/api/src/services/exchange-rates.ts` pronto  
✅ **Endpoint**: `GET /api/v1/currencies` pronto  
❌ **Problema**: `services/api` não roda em produção (só monólito)  
❌ **Problema**: Ninguém atualiza a tabela  
❌ **Problema**: Front ignora tudo isso

---

## 1. Solução: 3 Peças

### 1.1 Atualizador no Monólito (Backend)
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Localização**: No bootstrap do servidor (logo após conexão com Postgres)

```javascript
// Após linha ~52 (onde conecta ao Postgres)

// ============================================================
// EXCHANGE RATES AUTO-UPDATER
// ============================================================
const EXCHANGE_RATE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 min
const CURRENCIES_TO_TRACK = ['BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

let lastGoodRates = new Map(); // Fallback em memória

async function fetchExchangeRates() {
  console.log('[ExchangeRates] Fetching from external sources...');
  
  try {
    // FONTE 1: AwesomeAPI (Brasil, confiável, sem chave)
    const pairs = CURRENCIES_TO_TRACK.map(c => `USD-${c}`).join(',');
    const awesomeUrl = `https://economia.awesomeapi.com.br/json/last/${pairs}`;
    const res1 = await fetch(awesomeUrl, { timeout: 5000 });
    
    if (!res1.ok) throw new Error(`AwesomeAPI returned ${res1.status}`);
    const awesome = await res1.json();
    
    const rates1 = {};
    for (const curr of CURRENCIES_TO_TRACK) {
      const key = `USD${curr}`;
      if (awesome[key]?.bid) {
        rates1[curr] = parseFloat(awesome[key].bid);
      }
    }
    
    // FONTE 2: Frankfurter (BCE, backup)
    const frankfurterUrl = `https://api.frankfurter.app/latest?from=USD&to=${CURRENCIES_TO_TRACK.join(',')}`;
    const res2 = await fetch(frankfurterUrl, { timeout: 5000 });
    
    if (!res2.ok) throw new Error(`Frankfurter returned ${res2.status}`);
    const frank = await res2.json();
    const rates2 = frank.rates || {};
    
    // VALIDAÇÃO CRUZADA: Diferença > 5% = alerta
    const finalRates = {};
    for (const curr of CURRENCIES_TO_TRACK) {
      const r1 = rates1[curr];
      const r2 = rates2[curr];
      
      if (r1 && r2) {
        const diff = Math.abs(r1 - r2) / Math.max(r1, r2);
        if (diff > 0.05) {
          console.warn(`[ExchangeRates] ${curr}: divergence ${(diff * 100).toFixed(1)}% (${r1} vs ${r2})`);
          // Mantém última boa
          if (lastGoodRates.has(curr)) {
            finalRates[curr] = lastGoodRates.get(curr);
          } else {
            finalRates[curr] = (r1 + r2) / 2; // Média como fallback
          }
        } else {
          finalRates[curr] = r1; // AwesomeAPI é fonte primária
        }
      } else if (r1) {
        finalRates[curr] = r1;
      } else if (r2) {
        finalRates[curr] = r2;
      } else {
        console.warn(`[ExchangeRates] ${curr}: no data from both sources`);
        if (lastGoodRates.has(curr)) {
          finalRates[curr] = lastGoodRates.get(curr);
        }
      }
    }
    
    if (Object.keys(finalRates).length === 0) {
      throw new Error('No rates fetched from any source');
    }
    
    // GRAVA NO POSTGRES
    const now = new Date().toISOString();
    for (const [code, rate] of Object.entries(finalRates)) {
      await db.query(
        `INSERT INTO display_currencies (code, rate, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET rate = $2, updated_at = $3`,
        [code, rate, now]
      );
      lastGoodRates.set(code, rate); // Atualiza memória
    }
    
    // GRAVA NO REDIS (se disponível)
    if (redisClient?.isReady) {
      await redisClient.set(
        'exchange_rates',
        JSON.stringify({ rates: finalRates, updated_at: now }),
        { EX: 600 } // 10 min TTL
      );
    }
    
    console.log(`[ExchangeRates] ✅ Updated ${Object.keys(finalRates).length} rates`);
    
  } catch (err) {
    console.error('[ExchangeRates] ❌ Update failed:', err.message);
    // Continua com última boa em memória
  }
}

// INICIALIZA: Busca imediatamente
fetchExchangeRates().catch(console.error);

// LOOP: A cada 5 min
setInterval(() => {
  fetchExchangeRates().catch(console.error);
}, EXCHANGE_RATE_UPDATE_INTERVAL);
```

### 1.2 Endpoint no Monólito (Backend)
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Localização**: Logo após outros endpoints `/api/*`

```javascript
// Após linha ~900 (endpoints de depósito/saque/etc)

// GET /api/currencies — Retorna taxas atualizadas
app.get('/api/currencies', async (req, res) => {
  try {
    // 1. REDIS (mais rápido)
    if (redisClient?.isReady) {
      const cached = await redisClient.get('exchange_rates');
      if (cached) {
        const data = JSON.parse(cached);
        return res.json(
          Object.entries(data.rates).map(([code, rate]) => ({
            code,
            rate,
            updated_at: data.updated_at
          }))
        );
      }
    }
    
    // 2. POSTGRES (fallback)
    const result = await db.query(
      `SELECT code, rate, updated_at
       FROM display_currencies
       WHERE code = ANY($1)
       ORDER BY code`,
      [['BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN']]
    );
    
    if (result.rows.length > 0) {
      return res.json(result.rows);
    }
    
    // 3. MEMÓRIA (fallback de fallback)
    if (lastGoodRates.size > 0) {
      const now = new Date().toISOString();
      return res.json(
        Array.from(lastGoodRates.entries()).map(([code, rate]) => ({
          code,
          rate,
          updated_at: now
        }))
      );
    }
    
    // 4. ESTÁTICO (último recurso)
    const FALLBACK_RATES = {
      BRL: 5.50, MXN: 19.50, COP: 4150,
      ARS: 980, CLP: 940, PEN: 3.75
    };
    const now = new Date().toISOString();
    return res.json(
      Object.entries(FALLBACK_RATES).map(([code, rate]) => ({
        code,
        rate,
        updated_at: now
      }))
    );
    
  } catch (err) {
    console.error('[GET /api/currencies] Error:', err);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});
```

### 1.3 Frontend Consome Endpoint (React)
**Arquivo**: `apps/web/src/i18n/index.tsx`  
**Mudanças**:

1. **Criar hook `useExchangeRates`** (antes da função `formatCurrency`):

```typescript
// Após linha ~360 (onde está EXCHANGE_RATES fixo)

// Hook para buscar taxas atualizadas
function useExchangeRates() {
  const [rates, setRates] = React.useState<Record<string, number>>(EXCHANGE_RATES);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/currencies');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const newRates: Record<string, number> = {};
        let latestUpdate = '';
        
        data.forEach((item: { code: string; rate: number; updated_at: string }) => {
          newRates[item.code] = item.rate;
          if (item.updated_at > latestUpdate) latestUpdate = item.updated_at;
        });
        
        setRates(newRates);
        setUpdatedAt(latestUpdate);
      } catch (err) {
        console.warn('[useExchangeRates] Failed to fetch, using fallback:', err);
        // Mantém EXCHANGE_RATES estático como fallback
      }
    };
    
    fetchRates();
    const interval = setInterval(fetchRates, 5 * 60 * 1000); // 5 min
    
    return () => clearInterval(interval);
  }, []);
  
  return { rates, updatedAt };
}
```

2. **Usar hook dentro de `I18nProvider`** (linha ~430):

```typescript
// Dentro do I18nProvider (após linha ~430)
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = React.useState<string>(() => {
    return localStorage.getItem('locale') || 'pt-BR';
  });
  
  // ✅ NOVO: Buscar taxas reais
  const { rates, updatedAt } = useExchangeRates();
  
  const formatCurrency = React.useCallback((amountInCents: number, currencyCode?: string) => {
    const code = currencyCode || getCurrencyForLocale(locale);
    const rate = rates[code] || EXCHANGE_RATES[code] || 1; // ✅ Usa taxa atualizada
    const localAmount = (amountInCents / 100) * rate;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(localAmount);
  }, [locale, rates]); // ✅ Adiciona rates como dependência
  
  // ... resto do provider
}
```

---

## 2. Checklist de Implementação

### Backend (Monólito)
- [ ] Adicionar `fetchExchangeRates()` após conexão Postgres
- [ ] Adicionar `setInterval` para atualização a cada 5 min
- [ ] Adicionar endpoint `GET /api/currencies`
- [ ] Testar fetch de fontes externas manualmente
- [ ] Testar validação cruzada (diferença > 5%)
- [ ] Testar fallbacks (Redis → PG → mem → estático)

### Frontend (React)
- [ ] Criar hook `useExchangeRates()`
- [ ] Integrar hook no `I18nProvider`
- [ ] Atualizar `formatCurrency` para usar taxas dinâmicas
- [ ] Testar refetch a cada 5 min
- [ ] Testar fallback quando API falha

---

## 3. Testes Obrigatórios

### 3.1 Teste Unitário (Backend)
**Arquivo**: `tests/unit/exchange-rates.test.mjs`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Exchange Rates Updater', () => {
  it('should fetch from AwesomeAPI', async () => {
    const url = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
    const res = await fetch(url);
    assert.strictEqual(res.ok, true);
    
    const data = await res.json();
    assert.ok(data.USDBRL);
    assert.ok(typeof data.USDBRL.bid === 'string');
    assert.ok(parseFloat(data.USDBRL.bid) > 0);
  });
  
  it('should fetch from Frankfurter', async () => {
    const url = 'https://api.frankfurter.app/latest?from=USD&to=BRL';
    const res = await fetch(url);
    assert.strictEqual(res.ok, true);
    
    const data = await res.json();
    assert.ok(data.rates);
    assert.ok(typeof data.rates.BRL === 'number');
    assert.ok(data.rates.BRL > 0);
  });
  
  it('should detect divergence > 5%', () => {
    const r1 = 5.50;
    const r2 = 6.00; // +9% de diferença
    const diff = Math.abs(r1 - r2) / Math.max(r1, r2);
    assert.ok(diff > 0.05);
  });
  
  it('should accept convergence < 5%', () => {
    const r1 = 5.50;
    const r2 = 5.48; // -0.36% de diferença
    const diff = Math.abs(r1 - r2) / Math.max(r1, r2);
    assert.ok(diff < 0.05);
  });
});
```

### 3.2 Teste Manual (Backend)
```bash
# 1. Iniciar servidor
npm run dev

# 2. Aguardar 10 segundos (primeira atualização)

# 3. Testar endpoint
curl http://localhost:3001/api/currencies | jq

# Esperado:
# [
#   { "code": "ARS", "rate": 1050.23, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "BRL", "rate": 5.45, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "CLP", "rate": 940.10, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "COP", "rate": 4150.00, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "MXN", "rate": 19.50, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "PEN", "rate": 3.75, "updated_at": "2026-10-15T17:30:00Z" }
# ]
```

### 3.3 Teste Manual (Frontend)
```bash
# 1. Abrir DevTools → Network → XHR

# 2. Navegar para página com saldo

# 3. Verificar:
# - Request GET /api/currencies a cada ~5 min
# - Saldo atualiza automaticamente
# - Fallback funciona se API falhar (desligar servidor)
```

---

## 4. Segurança Financeira — CRÍTICO

### 4.1 Regra Imutável
```javascript
// ❌ NUNCA FAZER ISSO:
const stake_amount_local = user_input_brl / EXCHANGE_RATES['BRL'];

// ✅ CORRETO:
// Taxa de EXIBIÇÃO é separada de taxa de TRANSAÇÃO
// Depósitos/saques têm taxa própria, travada, gravada na transação
```

### 4.2 Verificação Obrigatória
```bash
# Verificar que EXCHANGE_RATES não é usado em transações
grep -rn "EXCHANGE_RATES" --include="*.ts" --include="*.tsx" --include="*.mjs" \
  | grep -i "stake\|payout\|deposit\|withdraw"

# Esperado: ZERO resultados (apenas em formatCurrency)
```

---

## 5. Rollback

### Se algo der errado:
```bash
# 1. Reverter commit
git revert HEAD

# 2. Front volta para taxa estática automaticamente (fallback)

# 3. Desligar atualizador (comentar setInterval no monólito)
```

---

## 6. Aprovação para Implementar

**Status**: ⏳ Pendente  
**Aprovador**: Brendan  
**Data**: _______________

**Após aprovação**:
1. Implementar backend (atualizador + endpoint)
2. Implementar frontend (hook + provider)
3. Rodar testes unitários
4. Rodar testes manuais
5. Verificar segurança (grep)
6. Commit: `feat(i18n): real-time exchange rates from external sources`
7. Prosseguir para Subetapa 2 (7.1 — Expandir Países)

---

**FIM DA SUBETAPA 1**
