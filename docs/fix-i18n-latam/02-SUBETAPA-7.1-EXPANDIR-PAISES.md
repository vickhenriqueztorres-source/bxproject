# Subetapa 2 — 7.1: Expandir Países LATAM (ALTO PRIORIDADE)

**Branch**: `fix/i18n-latam`  
**Prioridade**: 🔴 ALTO  
**Estimativa**: 2-3 horas  
**Dependências**: Subetapa 1 (taxas de câmbio reais)

---

## 0. Problema Atual

### 0.1 Sintomas
```javascript
// packages/shared/src/types.ts
export const PHASE2_COUNTRIES = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE']; // ❌ Apenas 6 países

// scripts/dev-live-feed.mjs:61 e 836
country: 'ES' // ❌ Default para Espanha (não é LATAM!)
```

**Impacto**:
- Usuário da Venezuela, Equador, Guatemala, etc → cai em genérico `es-MX`
- Sem moeda local correta
- Sem fuso horário correto
- Default `'ES'` (Espanha) não faz sentido para plataforma LATAM

### 0.2 Países Faltando (12)
| País | Código | Moeda | População | Prioridade |
|------|--------|-------|-----------|------------|
| Venezuela | VE | VES | 28M | 🟡 Alta |
| Equador | EC | USD | 18M | 🟡 Alta (dolarizado) |
| Guatemala | GT | GTQ | 18M | 🟢 Média |
| Bolívia | BO | BOB | 12M | 🟢 Média |
| República Dominicana | DO | DOP | 11M | 🟢 Média |
| Honduras | HN | HNL | 10M | 🟢 Média |
| Paraguai | PY | PYG | 7M | 🟢 Média |
| Nicarágua | NI | NIO | 7M | 🟢 Baixa |
| El Salvador | SV | USD | 6M | 🟢 Baixa (dolarizado) |
| Costa Rica | CR | CRC | 5M | 🟢 Baixa |
| Panamá | PA | USD | 4M | 🟢 Baixa (dolarizado) |
| Uruguai | UY | UYU | 3M | 🟢 Baixa |

---

## 1. Solução: 4 Peças

### 1.1 Expandir `PHASE2_COUNTRIES`
**Arquivo**: `packages/shared/src/types.ts`

```typescript
// Substituir linha ~85
export const PHASE2_COUNTRIES = [
  // Já implementados (6)
  'BR', 'MX', 'CO', 'AR', 'CL', 'PE',
  
  // Novos — Alta prioridade (2)
  'VE', // Venezuela — Bolívar Digital (VES)
  'EC', // Equador — Dolarizado (USD)
  
  // Novos — Média prioridade (6)
  'GT', // Guatemala — Quetzal (GTQ)
  'BO', // Bolívia — Boliviano (BOB)
  'DO', // Rep. Dominicana — Peso (DOP)
  'HN', // Honduras — Lempira (HNL)
  'PY', // Paraguai — Guarani (PYG)
  'NI', // Nicarágua — Córdoba (NIO)
  
  // Novos — Baixa prioridade (4)
  'SV', // El Salvador — Dolarizado (USD)
  'CR', // Costa Rica — Colón (CRC)
  'PA', // Panamá — Dolarizado (USD)
  'UY', // Uruguai — Peso (UYU)
] as const; // Total: 18 países
```

### 1.2 Adicionar `CURRENCY_CONFIGS`
**Arquivo**: `packages/shared/src/types.ts`  
**Localização**: Logo após `PHASE2_COUNTRIES`

```typescript
// Adicionar após linha ~100
export const CURRENCY_CONFIGS: Record<CountryCode, {
  code: string;
  symbol: string;
  name: string;
  precision: number;
}> = {
  // Já existentes (6)
  BR: { code: 'BRL', symbol: 'R$', name: 'Real brasileiro', precision: 2 },
  MX: { code: 'MXN', symbol: 'MX$', name: 'Peso mexicano', precision: 2 },
  CO: { code: 'COP', symbol: 'COL$', name: 'Peso colombiano', precision: 2 },
  AR: { code: 'ARS', symbol: 'AR$', name: 'Peso argentino', precision: 2 },
  CL: { code: 'CLP', symbol: 'CL$', name: 'Peso chileno', precision: 0 },
  PE: { code: 'PEN', symbol: 'S/', name: 'Sol peruano', precision: 2 },
  
  // Novos (12)
  VE: { code: 'VES', symbol: 'Bs.D', name: 'Bolívar Digital', precision: 2 },
  EC: { code: 'USD', symbol: '$', name: 'Dólar estadounidense', precision: 2 },
  GT: { code: 'GTQ', symbol: 'Q', name: 'Quetzal guatemalteco', precision: 2 },
  BO: { code: 'BOB', symbol: 'Bs.', name: 'Boliviano', precision: 2 },
  DO: { code: 'DOP', symbol: 'RD$', name: 'Peso dominicano', precision: 2 },
  HN: { code: 'HNL', symbol: 'L', name: 'Lempira hondureño', precision: 2 },
  PY: { code: 'PYG', symbol: '₲', name: 'Guaraní paraguayo', precision: 0 },
  NI: { code: 'NIO', symbol: 'C$', name: 'Córdoba nicaragüense', precision: 2 },
  SV: { code: 'USD', symbol: '$', name: 'Dólar estadounidense', precision: 2 },
  CR: { code: 'CRC', symbol: '₡', name: 'Colón costarricense', precision: 2 },
  PA: { code: 'USD', symbol: '$', name: 'Dólar estadounidense', precision: 2 },
  UY: { code: 'UYU', symbol: '$U', name: 'Peso uruguayo', precision: 2 },
};
```

### 1.3 Expandir `COUNTRY_TIMEZONES`
**Arquivo**: `packages/shared/src/types.ts`

```typescript
// Adicionar após linha ~120
export const COUNTRY_TIMEZONES: Record<CountryCode, string> = {
  // Já existentes (6)
  BR: 'America/Sao_Paulo',    // UTC-3
  MX: 'America/Mexico_City',   // UTC-6
  CO: 'America/Bogota',        // UTC-5
  AR: 'America/Argentina/Buenos_Aires', // UTC-3
  CL: 'America/Santiago',      // UTC-4 (UTC-3 no verão)
  PE: 'America/Lima',          // UTC-5
  
  // Novos (12)
  VE: 'America/Caracas',       // UTC-4
  EC: 'America/Guayaquil',     // UTC-5
  GT: 'America/Guatemala',     // UTC-6
  BO: 'America/La_Paz',        // UTC-4
  DO: 'America/Santo_Domingo', // UTC-4
  HN: 'America/Tegucigalpa',   // UTC-6
  PY: 'America/Asuncion',      // UTC-4 (UTC-3 no verão)
  NI: 'America/Managua',       // UTC-6
  SV: 'America/El_Salvador',   // UTC-6
  CR: 'America/Costa_Rica',    // UTC-6
  PA: 'America/Panama',        // UTC-5
  UY: 'America/Montevideo',    // UTC-3
};
```

### 1.4 Corrigir Default de Cadastro
**Arquivo**: `scripts/dev-live-feed.mjs`

**Mudança 1 — Linha ~61** (dentro de `parseCookies`):
```javascript
// ANTES (linha ~61):
country: 'ES', // ❌

// DEPOIS:
country: null, // ✅ Força escolha no cadastro
```

**Mudança 2 — Linha ~836** (criação de usuário):
```javascript
// ANTES (linha ~836):
country: 'ES', // ❌

// DEPOIS:
country: req.body.country || null, // ✅ Do formulário ou null
```

**Mudança 3 — Adicionar validação** (logo após linha ~836):
```javascript
// Após linha ~836 (depois de pegar country do body)
if (country && !PHASE2_COUNTRIES.includes(country)) {
  return res.status(400).json({
    error: 'País não suportado',
    supported: PHASE2_COUNTRIES
  });
}
```

---

## 2. Migration para Corrigir Usuários Existentes

### 2.1 Problema
Usuários cadastrados antes desta correção têm `country = 'ES'` (Espanha), mas são LATAM.

### 2.2 Heurística de Correção
Se `country = 'ES'` E `locale` começa com `es-`, inferir país pela moeda/idioma:
- `es-MX` → `MX`
- `es-CO` → `CO`
- `es-AR` → `AR`
- `es-CL` → `CL`
- `es-PE` → `PE`
- `es` genérico → deixar `null` (usuário escolhe)

### 2.3 Arquivo de Migration
**Arquivo**: `db/migrations/0071_fix_country_defaults.up.sql`

```sql
-- Migration 0071: Corrigir default 'ES' para países LATAM corretos
-- Data: 2026-10-15

-- Atualizar usuários com locale específico
UPDATE users
SET country = CASE
  WHEN locale = 'es-MX' THEN 'MX'
  WHEN locale = 'es-CO' THEN 'CO'
  WHEN locale = 'es-AR' THEN 'AR'
  WHEN locale = 'es-CL' THEN 'CL'
  WHEN locale = 'es-PE' THEN 'PE'
  WHEN locale LIKE 'pt-%' THEN 'BR'
  ELSE NULL -- Força escolha no próximo login
END
WHERE country = 'ES' -- Apenas usuários com default antigo
  AND locale IS NOT NULL;

-- Log de quantos foram corrigidos
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Corrigidos % usuários com country ES→LATAM', updated_count;
END $$;
```

**Arquivo**: `db/migrations/0071_fix_country_defaults.down.sql`

```sql
-- Rollback: Reverter para 'ES'
UPDATE users
SET country = 'ES'
WHERE country IN ('MX', 'CO', 'AR', 'CL', 'PE', 'BR')
  AND country IS NOT NULL;
```

---

## 3. Atualizar Câmbio para Novos Países

### 3.1 Problema
Subetapa 1 busca apenas 6 moedas: BRL, MXN, COP, ARS, CLP, PEN.

### 3.2 Moedas a Adicionar
- **VES** (Venezuela) — Alta volatilidade
- **GTQ** (Guatemala)
- **BOB** (Bolívia)
- **DOP** (Rep. Dominicana)
- **HNL** (Honduras)
- **PYG** (Paraguai)
- **NIO** (Nicarágua)
- **CRC** (Costa Rica)
- **UYU** (Uruguai)

**Nota**: EC, SV, PA usam USD (já é base).

### 3.3 Atualizar Atualizador de Câmbio
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Localização**: Dentro de `fetchExchangeRates()` (criado na Subetapa 1)

```javascript
// ANTES (Subetapa 1):
const CURRENCIES_TO_TRACK = ['BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

// DEPOIS (Subetapa 2):
const CURRENCIES_TO_TRACK = [
  'BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', // Já implementados
  'VES', 'GTQ', 'BOB', 'DOP', 'HNL',        // Novos (5)
  'PYG', 'NIO', 'CRC', 'UYU'                // Novos (4)
]; // Total: 15 moedas (3 países usam USD)
```

**URLs de fetch atualizadas**:
```javascript
// AwesomeAPI
const pairs = CURRENCIES_TO_TRACK.map(c => `USD-${c}`).join(',');
// USD-BRL,USD-MXN,...,USD-UYU

// Frankfurter
const frankfurterUrl = `https://api.frankfurter.app/latest?from=USD&to=${CURRENCIES_TO_TRACK.join(',')}`;
```

---

## 4. Frontend: Seletor de País no Cadastro

### 4.1 Problema
Se `country = null`, usuário precisa escolher no cadastro.

### 4.2 Componente de Seleção
**Arquivo**: `apps/web/src/components/CountrySelector.tsx` (NOVO)

```tsx
import React from 'react';
import { PHASE2_COUNTRIES, CURRENCY_CONFIGS, CountryCode } from '@binmax/shared';

interface CountrySelectorProps {
  value: CountryCode | null;
  onChange: (country: CountryCode) => void;
}

const COUNTRY_NAMES: Record<CountryCode, string> = {
  AR: '🇦🇷 Argentina', BO: '🇧🇴 Bolivia', BR: '🇧🇷 Brasil',
  CL: '🇨🇱 Chile', CO: '🇨🇴 Colombia', CR: '🇨🇷 Costa Rica',
  DO: '🇩🇴 Rep. Dominicana', EC: '🇪🇨 Ecuador', GT: '🇬🇹 Guatemala',
  HN: '🇭🇳 Honduras', MX: '🇲🇽 México', NI: '🇳🇮 Nicaragua',
  PA: '🇵🇦 Panamá', PE: '🇵🇪 Perú', PY: '🇵🇾 Paraguay',
  SV: '🇸🇻 El Salvador', UY: '🇺🇾 Uruguay', VE: '🇻🇪 Venezuela',
};

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  return (
    <div className="country-selector">
      <label htmlFor="country">País / Country</label>
      <select
        id="country"
        value={value || ''}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        required
      >
        <option value="">Selecciona tu país / Select your country</option>
        {PHASE2_COUNTRIES.map((code) => (
          <option key={code} value={code}>
            {COUNTRY_NAMES[code]} ({CURRENCY_CONFIGS[code].code})
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 4.3 Integrar no Formulário de Cadastro
**Arquivo**: `apps/web/src/pages/SignupPage.tsx`

```tsx
// Importar componente
import { CountrySelector } from '../components/CountrySelector';

// Adicionar state
const [country, setCountry] = useState<CountryCode | null>(null);

// Adicionar no formulário (antes do botão de submit)
<CountrySelector value={country} onChange={setCountry} />

// Adicionar no payload do POST /api/users
body: JSON.stringify({
  ...otherFields,
  country, // ✅ Envia país escolhido
}),
```

---

## 5. Checklist de Implementação

### Shared Types
- [ ] Expandir `PHASE2_COUNTRIES` de 6 para 18 países
- [ ] Adicionar `CURRENCY_CONFIGS` para 12 novos países
- [ ] Adicionar `COUNTRY_TIMEZONES` para 12 novos países

### Backend
- [ ] Corrigir default `country: 'ES'` → `null` (linha 61)
- [ ] Corrigir default no cadastro (linha 836)
- [ ] Adicionar validação de país suportado
- [ ] Expandir `CURRENCIES_TO_TRACK` de 6 para 15 moedas
- [ ] Testar fetch de câmbio com novas moedas

### Migration
- [ ] Criar `0071_fix_country_defaults.up.sql`
- [ ] Criar `0071_fix_country_defaults.down.sql`
- [ ] Rodar migration em dev
- [ ] Verificar quantos usuários foram corrigidos

### Frontend
- [ ] Criar `CountrySelector.tsx`
- [ ] Integrar no `SignupPage.tsx`
- [ ] Testar fluxo de cadastro com seleção de país
- [ ] Testar que país escolhido é salvo corretamente

---

## 6. Testes Obrigatórios

### 6.1 Teste Unitário (Shared)
**Arquivo**: `tests/unit/countries-config.test.mjs`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PHASE2_COUNTRIES, CURRENCY_CONFIGS, COUNTRY_TIMEZONES } from '../packages/shared/src/types.ts';

describe('Countries Config', () => {
  it('should have 18 LATAM countries', () => {
    assert.strictEqual(PHASE2_COUNTRIES.length, 18);
  });
  
  it('should have currency config for every country', () => {
    for (const country of PHASE2_COUNTRIES) {
      assert.ok(CURRENCY_CONFIGS[country], `Missing currency for ${country}`);
      assert.ok(CURRENCY_CONFIGS[country].code);
      assert.ok(CURRENCY_CONFIGS[country].symbol);
      assert.ok(typeof CURRENCY_CONFIGS[country].precision === 'number');
    }
  });
  
  it('should have timezone for every country', () => {
    for (const country of PHASE2_COUNTRIES) {
      assert.ok(COUNTRY_TIMEZONES[country], `Missing timezone for ${country}`);
      assert.ok(COUNTRY_TIMEZONES[country].startsWith('America/'));
    }
  });
  
  it('should correctly map dolarized countries to USD', () => {
    assert.strictEqual(CURRENCY_CONFIGS.EC.code, 'USD'); // Equador
    assert.strictEqual(CURRENCY_CONFIGS.SV.code, 'USD'); // El Salvador
    assert.strictEqual(CURRENCY_CONFIGS.PA.code, 'USD'); // Panamá
  });
});
```

### 6.2 Teste Manual (Migration)
```bash
# 1. Rodar migration
psql -U postgres -d binmax -f db/migrations/0071_fix_country_defaults.up.sql

# 2. Verificar quantos foram corrigidos
psql -U postgres -d binmax -c "SELECT country, COUNT(*) FROM users GROUP BY country ORDER BY COUNT(*) DESC;"

# Esperado:
#  country | count 
# ---------+-------
#  BR      |   450
#  MX      |   230
#  AR      |   180
#  CO      |   120
#  (null)  |    50  ← Usuários sem locale específico (vão escolher)
```

### 6.3 Teste Manual (Frontend)
```bash
# 1. Abrir página de cadastro

# 2. Verificar que dropdown tem 18 países

# 3. Selecionar "🇻🇪 Venezuela (VES)"

# 4. Completar cadastro

# 5. Verificar no Postgres:
psql -U postgres -d binmax -c "SELECT id, country, locale FROM users ORDER BY created_at DESC LIMIT 1;"

# Esperado:
#  id  | country | locale 
# -----+---------+--------
#  1001|   VE    | es-VE
```

---

## 7. Rollback

### Se algo der errado:
```bash
# 1. Reverter commit
git revert HEAD

# 2. Rollback migration
psql -U postgres -d binmax -f db/migrations/0071_fix_country_defaults.down.sql

# 3. Usuários voltam para 'ES' (ou mantêm país escolhido se já escolheram)
```

---

## 8. Aprovação para Implementar

**Status**: ⏳ Pendente  
**Aprovador**: Brendan  
**Data**: _______________

**Após aprovação**:
1. Implementar mudanças em types.ts (3 configs)
2. Implementar mudanças no monólito (defaults + validação)
3. Implementar migration
4. Implementar CountrySelector no frontend
5. Rodar testes unitários
6. Rodar migration em dev
7. Testar fluxo de cadastro
8. Commit: `feat(i18n): expand LATAM countries from 6 to 18`
9. Prosseguir para Subetapa 3 (7.5 — PIX Correto)

---

**FIM DA SUBETAPA 2**
