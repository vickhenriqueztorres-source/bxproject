# Subetapa 3 — 7.5: PIX Correto por País (MÉDIO)

**Branch**: `fix/i18n-latam`  
**Prioridade**: 🟡 MÉDIO  
**Estimativa**: 1 hora  
**Dependências**: Subetapa 2 (18 países configurados)

---

## 0. Problema Atual

### 0.1 Sintoma
```javascript
// scripts/dev-live-feed.mjs ~linha 1666
// Gera PIX para QUALQUER país e método

if (method === 'PIX' || method === 'BANK' || method === 'CARD') {
  // ❌ Gera payload PIX brasileiro para México, Argentina, etc!
  instructions = `
    00020126...
    BR.GOV.BCB.PIX...
    BINMAX LTDA SAO PAULO...
  `;
}
```

**Impacto**:
- Usuário mexicano vê QR Code PIX (não existe no México!)
- Usuário argentino recebe instruções de transferência bancária brasileira
- Confusão e depósitos falhados

---

## 1. Solução: Instruções por País e Método

### 1.1 Matriz de Métodos de Depósito
| País | PIX | Transferência Bancária | Cartão | Crypto |
|------|-----|------------------------|--------|--------|
| BR   | ✅ Sim (EMV QR) | ✅ TED/DOC | ✅ | ✅ |
| MX   | ❌ | ✅ SPEI | ✅ | ✅ |
| AR   | ❌ | ✅ CVU/CBU | ✅ | ✅ |
| CO   | ❌ | ✅ PSE | ✅ | ✅ |
| CL   | ❌ | ✅ Transferencia | ✅ | ✅ |
| PE   | ❌ | ✅ Transferencia | ✅ | ✅ |
| VE   | ❌ | ✅ Transferencia | ✅ | ✅ |
| EC   | ❌ | ✅ Transferencia | ✅ | ✅ |
| Outros | ❌ | ✅ Wire Transfer | ✅ | ✅ |

### 1.2 Implementação
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Localização**: Substituir lógica de instruções (~linha 1666)

```javascript
// ANTES (~linha 1666):
if (method === 'PIX' || method === 'BANK' || method === 'CARD') {
  instructions = `00020126...`; // ❌ PIX para todos
}

// DEPOIS:
function generateDepositInstructions(country, method, amount, depositId) {
  // PIX: Apenas para Brasil
  if (method === 'PIX') {
    if (country !== 'BR') {
      throw new Error('PIX is only available in Brazil');
    }
    return generatePixQrCode(amount, depositId);
  }
  
  // Transferência bancária: Instruções por país
  if (method === 'BANK') {
    return generateBankInstructions(country, amount, depositId);
  }
  
  // Cartão e Crypto: Genérico
  if (method === 'CARD') {
    return generateCardInstructions(country, amount);
  }
  
  if (method === 'CRYPTO') {
    return generateCryptoInstructions(amount, depositId);
  }
  
  throw new Error(`Unknown deposit method: ${method}`);
}

// Substituir linha ~1666 por:
const instructions = generateDepositInstructions(
  user.country,
  req.body.method,
  req.body.amount,
  depositId
);
```

### 1.3 Função: PIX (Apenas Brasil)
```javascript
function generatePixQrCode(amountInCents, depositId) {
  // Mantém lógica atual, mas APENAS se country === 'BR'
  const pixKey = process.env.PIX_KEY || '33578457000164'; // CNPJ Binmax
  const merchantName = 'BINMAX LTDA';
  const merchantCity = 'SAO PAULO';
  const txid = depositId.substring(0, 25); // Máx 25 chars
  
  // EMV QR Code format (copiar lógica atual completa)
  const payload = [
    '00020126', // Payload Format Indicator
    '0014BR.GOV.BCB.PIX',
    `01${pixKey.length.toString().padStart(2, '0')}${pixKey}`,
    `52040000`, // Merchant Category Code
    '5303986',  // Currency BRL
    `54${(amountInCents / 100).toFixed(2).length.toString().padStart(2, '0')}${(amountInCents / 100).toFixed(2)}`,
    '5802BR',
    `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`,
    `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`,
    `62${(txid.length + 8).toString().padStart(2, '0')}05${txid.length.toString().padStart(2, '0')}${txid}`,
    '6304', // CRC placeholder
  ].join('');
  
  // Calcular CRC16 CCITT (manter função atual)
  const crc = calculateCRC16(payload);
  return payload + crc;
}
```

### 1.4 Função: Transferência Bancária por País
```javascript
function generateBankInstructions(country, amountInCents, depositId) {
  const amount = (amountInCents / 100).toFixed(2);
  
  const instructions = {
    BR: {
      title: 'Transferência Bancária (TED/DOC)',
      bank: 'Banco Binmax',
      account: '1234-5',
      agency: '0001',
      cnpj: '33.578.457/0001-64',
      holder: 'BINMAX LTDA',
      reference: depositId,
    },
    
    MX: {
      title: 'Transferencia Bancaria (SPEI)',
      bank: 'Banco Binmax México',
      clabe: '012345678901234567', // 18 dígitos
      rfc: 'BMX010101ABC',
      holder: 'BINMAX MEXICO SA DE CV',
      reference: depositId,
    },
    
    AR: {
      title: 'Transferencia Bancaria (CVU/CBU)',
      bank: 'Banco Binmax Argentina',
      cvu: '0000003100012345678901', // 22 dígitos
      cbu: '0170001640000012345678',  // 22 dígitos
      cuit: '30-12345678-9',
      holder: 'BINMAX ARGENTINA SA',
      reference: depositId,
    },
    
    CO: {
      title: 'Pago PSE o Transferencia',
      bank: 'Banco Binmax Colombia',
      account: '123456789',
      accountType: 'Ahorros',
      nit: '901.234.567-8',
      holder: 'BINMAX COLOMBIA SAS',
      reference: depositId,
    },
    
    CL: {
      title: 'Transferencia Bancaria',
      bank: 'Banco Binmax Chile',
      account: '12345678',
      rut: '76.123.456-7',
      holder: 'BINMAX CHILE SpA',
      reference: depositId,
    },
    
    PE: {
      title: 'Transferencia Bancaria',
      bank: 'Banco Binmax Perú',
      account: '191-1234567-0-89',
      ruc: '20123456789',
      holder: 'BINMAX PERU SAC',
      reference: depositId,
    },
    
    // Default para outros países
    DEFAULT: {
      title: 'Wire Transfer',
      bank: 'Binmax International Bank',
      swift: 'BINMAXUS',
      iban: 'US12BINM0001234567890',
      holder: 'BINMAX GLOBAL INC',
      reference: depositId,
    },
  };
  
  const data = instructions[country] || instructions.DEFAULT;
  
  // Formatar como texto legível
  return `
${data.title}
━━━━━━━━━━━━━━━━━━━━━━
Banco: ${data.bank}
${data.account ? `Cuenta: ${data.account}` : ''}
${data.agency ? `Agencia: ${data.agency}` : ''}
${data.clabe ? `CLABE: ${data.clabe}` : ''}
${data.cvu ? `CVU: ${data.cvu}` : ''}
${data.cbu ? `CBU: ${data.cbu}` : ''}
${data.swift ? `SWIFT: ${data.swift}` : ''}
${data.iban ? `IBAN: ${data.iban}` : ''}

Titular: ${data.holder}
${data.cnpj ? `CNPJ: ${data.cnpj}` : ''}
${data.rfc ? `RFC: ${data.rfc}` : ''}
${data.cuit ? `CUIT: ${data.cuit}` : ''}
${data.nit ? `NIT: ${data.nit}` : ''}
${data.rut ? `RUT: ${data.rut}` : ''}
${data.ruc ? `RUC: ${data.ruc}` : ''}

Monto: ${amount} ${CURRENCY_CONFIGS[country]?.code || 'USD'}
Referencia: ${depositId}

⚠️ Importante: Incluir la referencia en el concepto/descripción del pago
  `.trim();
}
```

### 1.5 Validação no Endpoint
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Localização**: No endpoint `POST /api/deposits` (~linha 1650)

```javascript
// Adicionar validação ANTES de gerar instruções
app.post('/api/deposits', async (req, res) => {
  const { method, amount } = req.body;
  const user = req.user; // Do middleware de autenticação
  
  // ✅ VALIDAR: PIX apenas para Brasil
  if (method === 'PIX' && user.country !== 'BR') {
    return res.status(400).json({
      error: 'PIX is only available in Brazil',
      availableMethods: ['BANK', 'CARD', 'CRYPTO']
    });
  }
  
  // ... resto do código (gerar instruções, criar registro, etc)
});
```

---

## 2. Frontend: Exibir Métodos por País

### 2.1 Problema
Frontend oferece PIX para todos os países.

### 2.2 Solução
**Arquivo**: `apps/web/src/pages/DepositPage.tsx`

```tsx
// Adicionar função para métodos disponíveis
function getAvailableMethodsForCountry(country: CountryCode): string[] {
  const allMethods = {
    BR: ['PIX', 'BANK', 'CARD', 'CRYPTO'],
    // Outros países: sem PIX
    DEFAULT: ['BANK', 'CARD', 'CRYPTO'],
  };
  
  return allMethods[country] || allMethods.DEFAULT;
}

// No componente
const availableMethods = getAvailableMethodsForCountry(user.country);

// Renderizar apenas métodos disponíveis
{availableMethods.includes('PIX') && (
  <button onClick={() => setMethod('PIX')}>PIX</button>
)}
{availableMethods.includes('BANK') && (
  <button onClick={() => setMethod('BANK')}>Transferência</button>
)}
{availableMethods.includes('CARD') && (
  <button onClick={() => setMethod('CARD')}>Cartão</button>
)}
{availableMethods.includes('CRYPTO') && (
  <button onClick={() => setMethod('CRYPTO')}>Crypto</button>
)}
```

---

## 3. Checklist de Implementação

### Backend
- [ ] Criar função `generateDepositInstructions(country, method, amount, depositId)`
- [ ] Criar função `generatePixQrCode()` (apenas Brasil)
- [ ] Criar função `generateBankInstructions()` (18 países)
- [ ] Adicionar validação PIX no endpoint `POST /api/deposits`
- [ ] Testar PIX com `country = 'BR'` → sucesso
- [ ] Testar PIX com `country = 'MX'` → erro 400

### Frontend
- [ ] Criar função `getAvailableMethodsForCountry()`
- [ ] Renderizar apenas métodos disponíveis
- [ ] Testar que PIX aparece apenas para Brasil
- [ ] Testar que outros países veem BANK/CARD/CRYPTO

---

## 4. Testes Obrigatórios

### 4.1 Teste Unitário
**Arquivo**: `tests/unit/pix-instructions.test.mjs`

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('PIX Instructions', () => {
  it('should generate PIX for Brazil only', () => {
    const country = 'BR';
    const method = 'PIX';
    
    // Não deve lançar erro
    assert.doesNotThrow(() => {
      generateDepositInstructions(country, method, 10000, 'dep123');
    });
  });
  
  it('should reject PIX for non-Brazil countries', () => {
    const countries = ['MX', 'AR', 'CO', 'CL', 'PE', 'VE'];
    
    for (const country of countries) {
      assert.throws(() => {
        generateDepositInstructions(country, 'PIX', 10000, 'dep123');
      }, /PIX is only available in Brazil/);
    }
  });
  
  it('should generate bank instructions for all countries', () => {
    const countries = ['BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC'];
    
    for (const country of countries) {
      const instructions = generateDepositInstructions(country, 'BANK', 10000, 'dep123');
      
      assert.ok(instructions.includes('Banco'));
      assert.ok(instructions.includes('Referencia: dep123'));
      assert.ok(instructions.length > 100); // Instruções completas
    }
  });
});
```

### 4.2 Teste Manual (Backend)
```bash
# Teste 1: PIX para Brasil (sucesso)
curl -X POST http://localhost:3001/api/deposits \
  -H "Authorization: Bearer <token_br>" \
  -H "Content-Type: application/json" \
  -d '{"method":"PIX","amount":10000}'

# Esperado: HTTP 200, QR Code PIX

# Teste 2: PIX para México (erro)
curl -X POST http://localhost:3001/api/deposits \
  -H "Authorization: Bearer <token_mx>" \
  -H "Content-Type: application/json" \
  -d '{"method":"PIX","amount":10000}'

# Esperado: HTTP 400
# {
#   "error": "PIX is only available in Brazil",
#   "availableMethods": ["BANK", "CARD", "CRYPTO"]
# }

# Teste 3: BANK para México (sucesso)
curl -X POST http://localhost:3001/api/deposits \
  -H "Authorization: Bearer <token_mx>" \
  -H "Content-Type: application/json" \
  -d '{"method":"BANK","amount":10000}'

# Esperado: HTTP 200, instruções SPEI
```

### 4.3 Teste Manual (Frontend)
```bash
# 1. Login como usuário brasileiro
# 2. Ir para Depósito
# 3. Verificar: botões PIX, Transferência, Cartão, Crypto

# 4. Logout, login como usuário mexicano
# 5. Ir para Depósito
# 6. Verificar: botões Transferência, Cartão, Crypto (SEM PIX)
```

---

## 5. Segurança

### 5.1 Validação Obrigatória
```javascript
// ❌ NUNCA confiar apenas no frontend
// Frontend pode ser manipulado (DevTools)

// ✅ SEMPRE validar no backend
if (method === 'PIX' && user.country !== 'BR') {
  return res.status(400).json({ error: 'PIX not available' });
}
```

### 5.2 Verificação
```bash
# Grep: Garantir que validação existe
grep -n "PIX.*country.*BR" scripts/dev-live-feed.mjs

# Esperado: Linha com validação no endpoint
```

---

## 6. Rollback

```bash
# 1. Reverter commit
git revert HEAD

# 2. PIX volta a ser gerado para todos (comportamento antigo)
# 3. Nenhuma migration de banco necessária
```

---

## 7. Aprovação para Implementar

**Status**: ⏳ Pendente  
**Aprovador**: Brendan  
**Data**: _______________

**Após aprovação**:
1. Implementar funções de instruções por país
2. Adicionar validação PIX no backend
3. Atualizar frontend (métodos disponíveis por país)
4. Rodar testes unitários
5. Testar manualmente PIX (BR) e outros países
6. Commit: `fix(deposits): PIX instructions only for Brazil`
7. Prosseguir para Subetapa 4 (7.4 — Vazamento de Idioma)

---

**FIM DA SUBETAPA 3**
