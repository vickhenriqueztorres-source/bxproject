# Subetapa 4 — 7.4: Vazamento de Idioma (MÉDIO)

**Branch**: `fix/i18n-latam`  
**Prioridade**: 🟡 MÉDIO  
**Estimativa**: 2 horas  
**Dependências**: Subetapa 2 (estruturas de país/idioma prontas)

---

## 0. Problema Atual

### 0.1 PT Fixo Exibido a Usuários ES
```javascript
// Arena: strings hardcoded em português
'Você'                          // arena/use-arena.ts
'Índice de Volatilidade'        // arena/engine.ts
'Sala Bronze'                   // arena/use-arena.ts
'Sala Prata'                    // arena/use-arena.ts
'Sala Ouro'                     // arena/use-arena.ts
'Clássico'                      // arena/engine.ts
```

### 0.2 ES Fixo Exibido a Usuários PT
```javascript
// App.tsx ~linha 201
'¡Ganaste!'                     // Mensagem de vitória
'Perdiste'                      // Mensagem de derrota

// Mensagens do servidor (dev-live-feed.mjs)
'Saldo insuficiente'            // Deveria ser em PT/ES conforme usuário
'Termina en'                    // Countdown
'Finalizado'                    // Status do contrato

// Traders mood (mood indicator)
'Compra' / 'Venta'              // Deveria ser Compra/Venda em PT
```

**Impacto**:
- Experiência inconsistente (metade PT, metade ES)
- Confusão para usuários novatos
- Aparência de tradução incompleta

---

## 1. Solução: Localizar Todas as Strings

### 1.1 Expandir Catálogos de i18n
**Arquivo**: `apps/web/src/i18n/locales/pt.json`

```json
{
  // Já existente (~110 chaves)
  "common.balance": "Saldo",
  "common.deposit": "Depositar",
  ...
  
  // ✅ ADICIONAR: Arena
  "arena.you": "Você",
  "arena.volatilityIndex": "Índice de Volatilidade",
  "arena.roomBronze": "Sala Bronze",
  "arena.roomSilver": "Sala Prata",
  "arena.roomGold": "Sala Ouro",
  "arena.classic": "Clássico",
  "arena.turbo": "Turbo",
  
  // ✅ ADICIONAR: Resultados
  "result.win": "Você ganhou!",
  "result.loss": "Você perdeu",
  "result.draw": "Empate",
  
  // ✅ ADICIONAR: Status de contrato
  "contract.pending": "Pendente",
  "contract.active": "Ativo",
  "contract.finished": "Finalizado",
  "contract.endsIn": "Termina em",
  
  // ✅ ADICIONAR: Traders mood
  "mood.buy": "Compra",
  "mood.sell": "Venda",
  "mood.neutral": "Neutro",
  
  // ✅ ADICIONAR: Erros
  "error.insufficientBalance": "Saldo insuficiente",
  "error.serverError": "Erro no servidor",
  "error.networkError": "Erro de conexão"
}
```

**Arquivo**: `apps/web/src/i18n/locales/es.json`

```json
{
  // Já existente (~110 chaves)
  "common.balance": "Saldo",
  "common.deposit": "Depositar",
  ...
  
  // ✅ ADICIONAR: Arena
  "arena.you": "Tú",
  "arena.volatilityIndex": "Índice de Volatilidad",
  "arena.roomBronze": "Sala Bronce",
  "arena.roomSilver": "Sala Plata",
  "arena.roomGold": "Sala Oro",
  "arena.classic": "Clásico",
  "arena.turbo": "Turbo",
  
  // ✅ ADICIONAR: Resultados
  "result.win": "¡Ganaste!",
  "result.loss": "Perdiste",
  "result.draw": "Empate",
  
  // ✅ ADICIONAR: Status de contrato
  "contract.pending": "Pendiente",
  "contract.active": "Activo",
  "contract.finished": "Finalizado",
  "contract.endsIn": "Termina en",
  
  // ✅ ADICIONAR: Traders mood
  "mood.buy": "Compra",
  "mood.sell": "Venta",
  "mood.neutral": "Neutral",
  
  // ✅ ADICIONAR: Erros
  "error.insufficientBalance": "Saldo insuficiente",
  "error.serverError": "Error del servidor",
  "error.networkError": "Error de conexión"
}
```

### 1.2 Corrigir Arena (Frontend)
**Arquivo**: `apps/web/src/arena/use-arena.ts`

```typescript
// ANTES (linha aproximada onde aparece 'Você'):
const playerLabel = 'Você';

// DEPOIS:
import { useTranslation } from '../i18n';

function useArena() {
  const { t } = useTranslation();
  
  const playerLabel = t('arena.you');
  
  // ... resto do código
}
```

**Arquivo**: `apps/web/src/arena/engine.ts`

```typescript
// ANTES:
const assetName = asset === 'VOLATILITY_INDEX' ? 'Índice de Volatilidade' : asset;
const mode = isClassic ? 'Clássico' : 'Turbo';

// DEPOIS:
import { t } from '../i18n'; // Import direto se não for component

const assetName = asset === 'VOLATILITY_INDEX' 
  ? t('arena.volatilityIndex') 
  : asset;
const mode = isClassic ? t('arena.classic') : t('arena.turbo');
```

**Salas** (onde aparecem):
```typescript
// ANTES:
const rooms = [
  { id: 'bronze', name: 'Sala Bronze', ... },
  { id: 'silver', name: 'Sala Prata', ... },
  { id: 'gold', name: 'Sala Ouro', ... },
];

// DEPOIS:
const rooms = [
  { id: 'bronze', name: t('arena.roomBronze'), ... },
  { id: 'silver', name: t('arena.roomSilver'), ... },
  { id: 'gold', name: t('arena.roomGold'), ... },
];
```

### 1.3 Corrigir Mensagens de Resultado (Frontend)
**Arquivo**: `apps/web/src/App.tsx` (~linha 201)

```tsx
// ANTES:
{result === 'WIN' && <div className="result-win">¡Ganaste!</div>}
{result === 'LOSS' && <div className="result-loss">Perdiste</div>}
{result === 'DRAW' && <div className="result-draw">Empate</div>}

// DEPOIS:
import { useTranslation } from './i18n';

function App() {
  const { t } = useTranslation();
  
  // ... código
  
  {result === 'WIN' && <div className="result-win">{t('result.win')}</div>}
  {result === 'LOSS' && <div className="result-loss">{t('result.loss')}</div>}
  {result === 'DRAW' && <div className="result-draw">{t('result.draw')}</div>}
}
```

### 1.4 Corrigir Traders Mood (Frontend)
**Arquivo**: Localizar onde aparece "Compra" / "Venta"

```tsx
// ANTES:
const moodLabel = mood === 'BULLISH' ? 'Compra' : mood === 'BEARISH' ? 'Venta' : 'Neutro';

// DEPOIS:
const moodLabel = mood === 'BULLISH' 
  ? t('mood.buy') 
  : mood === 'BEARISH' 
    ? t('mood.sell') 
    : t('mood.neutral');
```

### 1.5 Corrigir Mensagens do Servidor (Backend)
**Arquivo**: `scripts/dev-live-feed.mjs`

**Problema**: Backend não tem acesso ao locale do usuário no momento do erro.

**Solução 1 — Enviar Código de Erro** (Recomendado):
```javascript
// ANTES (~linha com erro de saldo):
return res.status(400).json({ error: 'Saldo insuficiente' });

// DEPOIS:
return res.status(400).json({ 
  error: 'INSUFFICIENT_BALANCE', // ✅ Código
  message: 'Insufficient balance' // Fallback em inglês
});
```

**Frontend traduz**:
```typescript
// apps/web/src/api/client.ts
async function handleApiError(response) {
  const data = await response.json();
  
  if (data.error === 'INSUFFICIENT_BALANCE') {
    throw new Error(t('error.insufficientBalance'));
  }
  
  // Fallback para mensagem do servidor
  throw new Error(data.message || 'Unknown error');
}
```

**Solução 2 — Backend Detecta Locale** (Alternativa):
```javascript
// Backend lê locale do usuário
const userLocale = user.locale || 'pt-BR';
const translations = {
  'pt-BR': { insufficientBalance: 'Saldo insuficiente' },
  'es-MX': { insufficientBalance: 'Saldo insuficiente' },
  // ... etc
};

return res.status(400).json({ 
  error: translations[userLocale].insufficientBalance 
});
```

**Escolha**: Solução 1 (códigos de erro) é mais limpa e escalável.

---

## 2. Grep: Encontrar Todas as Strings Hardcoded

### 2.1 Strings PT no Arena
```bash
# Buscar strings hardcoded em português
grep -rn "Você\|Índice de Volatilidade\|Sala Bronze\|Sala Prata\|Sala Ouro\|Clássico" \
  apps/web/src/arena/ \
  --include="*.ts" --include="*.tsx"

# Esperado: Listar todos os arquivos com strings PT
```

### 2.2 Strings ES no Frontend
```bash
# Buscar strings hardcoded em espanhol
grep -rn "¡Ganaste!\|Perdiste\|Compra\|Venta" \
  apps/web/src/ \
  --include="*.ts" --include="*.tsx"

# Esperado: Listar App.tsx e componentes de mood
```

### 2.3 Strings ES no Backend
```bash
# Buscar strings hardcoded em espanhol
grep -rn "Saldo insuficiente\|Termina en\|Finalizado" \
  scripts/dev-live-feed.mjs

# Esperado: Listar linhas com erros/mensagens
```

---

## 3. Checklist de Implementação

### Catálogos i18n
- [ ] Adicionar ~15 chaves novas em `pt.json`
- [ ] Adicionar ~15 chaves novas em `es.json`
- [ ] Verificar que chaves PT e ES estão pareadas

### Arena (Frontend)
- [ ] Substituir `'Você'` por `t('arena.you')`
- [ ] Substituir `'Índice de Volatilidade'` por `t('arena.volatilityIndex')`
- [ ] Substituir nomes de salas (Bronze/Prata/Ouro)
- [ ] Substituir `'Clássico'` e `'Turbo'`

### Resultados (Frontend)
- [ ] Substituir `'¡Ganaste!'` por `t('result.win')`
- [ ] Substituir `'Perdiste'` por `t('result.loss')`
- [ ] Substituir `'Empate'` por `t('result.draw')`

### Traders Mood (Frontend)
- [ ] Substituir `'Compra'/'Venta'` por `t('mood.buy')`/`t('mood.sell')`

### Mensagens Backend
- [ ] Mudar erros para códigos (`INSUFFICIENT_BALANCE`)
- [ ] Frontend traduz códigos usando catálogos

---

## 4. Testes Obrigatórios

### 4.1 Teste Manual (Arena PT)
```bash
# 1. Login como usuário PT-BR
# 2. Entrar na arena
# 3. Verificar:
#    - Label "Você" (não "Tú")
#    - Salas "Bronze/Prata/Ouro" (não "Bronce/Plata/Oro")
#    - Modo "Clássico" (não "Clásico")
```

### 4.2 Teste Manual (Arena ES)
```bash
# 1. Logout, login como usuário ES-MX
# 2. Entrar na arena
# 3. Verificar:
#    - Label "Tú" (não "Você")
#    - Salas "Bronce/Plata/Oro" (não "Bronze/Prata/Ouro")
#    - Modo "Clásico" (não "Clássico")
```

### 4.3 Teste Manual (Resultados)
```bash
# 1. Fazer trade e ganhar
# 2. Verificar mensagem:
#    - PT: "Você ganhou!"
#    - ES: "¡Ganaste!"

# 3. Fazer trade e perder
# 4. Verificar mensagem:
#    - PT: "Você perdeu"
#    - ES: "Perdiste"
```

### 4.4 Teste Manual (Traders Mood)
```bash
# 1. Verificar indicador de mood:
#    - PT: "Compra" / "Venda"
#    - ES: "Compra" / "Venta"
```

### 4.5 Teste Manual (Erros do Servidor)
```bash
# 1. Tentar depositar sem saldo
# 2. Verificar mensagem de erro:
#    - PT: "Saldo insuficiente"
#    - ES: "Saldo insuficiente"
```

### 4.6 Teste Unitário (Catálogos)
**Arquivo**: `tests/unit/language-leakage.test.mjs`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import pt from '../apps/web/src/i18n/locales/pt.json';
import es from '../apps/web/src/i18n/locales/es.json';

describe('Language Leakage Prevention', () => {
  it('should have same keys in PT and ES catalogs', () => {
    const ptKeys = Object.keys(pt).sort();
    const esKeys = Object.keys(es).sort();
    
    assert.deepStrictEqual(ptKeys, esKeys, 'PT and ES must have same keys');
  });
  
  it('PT catalog should not contain ES words', () => {
    const ptValues = Object.values(pt).join(' ');
    
    // Palavras ES que não devem aparecer em PT
    const spanishWords = ['Ganaste', 'Perdiste', 'Venta', 'Tú'];
    
    for (const word of spanishWords) {
      assert.ok(
        !ptValues.includes(word),
        `PT catalog contains Spanish word: ${word}`
      );
    }
  });
  
  it('ES catalog should not contain PT words', () => {
    const esValues = Object.values(es).join(' ');
    
    // Palavras PT que não devem aparecer em ES
    const portugueseWords = ['Você', 'ganhou', 'perdeu', 'Venda'];
    
    for (const word of portugueseWords) {
      assert.ok(
        !esValues.includes(word),
        `ES catalog contains Portuguese word: ${word}`
      );
    }
  });
  
  it('should have arena keys in both catalogs', () => {
    const arenaKeys = [
      'arena.you',
      'arena.volatilityIndex',
      'arena.roomBronze',
      'arena.roomSilver',
      'arena.roomGold',
      'arena.classic',
      'arena.turbo',
    ];
    
    for (const key of arenaKeys) {
      assert.ok(pt[key], `Missing ${key} in PT catalog`);
      assert.ok(es[key], `Missing ${key} in ES catalog`);
    }
  });
});
```

---

## 5. Grep Final: Garantir Zero Vazamentos

```bash
# 1. Verificar que não há mais strings PT hardcoded em arena
grep -rn "Você\|Sala Bronze\|Sala Prata" apps/web/src/arena/ --include="*.ts" --include="*.tsx"
# Esperado: ZERO resultados (todas foram substituídas por t())

# 2. Verificar que não há mais strings ES hardcoded em App.tsx
grep -n "¡Ganaste!\|Perdiste" apps/web/src/App.tsx
# Esperado: ZERO resultados (todas foram substituídas por t())

# 3. Verificar que backend usa códigos de erro
grep -n "error:.*Saldo insuficiente" scripts/dev-live-feed.mjs
# Esperado: ZERO resultados (agora usa códigos tipo 'INSUFFICIENT_BALANCE')
```

---

## 6. Rollback

```bash
# 1. Reverter commit
git revert HEAD

# 2. Strings hardcoded voltam (comportamento antigo)
# 3. Nenhuma migration de banco necessária
```

---

## 7. Aprovação para Implementar

**Status**: ⏳ Pendente  
**Aprovador**: Brendan  
**Data**: _______________

**Após aprovação**:
1. Expandir catálogos `pt.json` e `es.json` (~15 chaves cada)
2. Substituir strings hardcoded no Arena
3. Substituir strings hardcoded em App.tsx (resultados)
4. Substituir strings hardcoded em traders mood
5. Mudar backend para códigos de erro
6. Rodar testes manuais (PT e ES)
7. Rodar testes unitários
8. Grep final (garantir zero vazamentos)
9. Commit: `fix(i18n): remove language leakage in arena and results`
10. Prosseguir para Subetapa 5 (7.3 — Migrar Catálogos) **OU** encerrar se tempo acabar

---

**FIM DA SUBETAPA 4**
