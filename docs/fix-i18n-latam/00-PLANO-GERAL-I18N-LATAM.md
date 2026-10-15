# Plano Geral — Correção de i18n e Países LATAM

**Projeto**: Binmax (brokerproject)  
**Branch**: `fix/i18n-latam`  
**Data**: 2026-10-15  
**Prioridade**: ALTO (problemas 7.1 e 7.2) → MÉDIO (7.3 a 7.6)

---

## 0. Contexto e Escopo

### 0.1 Objetivo
Corrigir **7 problemas críticos** de internacionalização e suporte a países LATAM, priorizando os 2 ALTO que afetam diretamente a experiência do usuário:

1. **7.1 (ALTO)**: Cobertura de apenas 6 países (expandir para ~15-18 países LATAM)
2. **7.2 (ALTO)**: Taxas de câmbio fixas no front (implementar atualização automática)
3. **7.3 (MÉDIO)**: i18n majoritariamente por ternário inline (migrar para catálogos)
4. **7.4 (MÉDIO)**: Vazamento de idioma cruzado (PT em ES e vice-versa)
5. **7.5 (MÉDIO)**: Payload PIX para todos os países (corrigir por país/método)
6. **7.6 (AÇÕES)**: Roadmap de melhorias

### 0.2 Zonas Proibidas (NÃO TOCAR)
- ❌ **Nenhuma restrição** neste PR (diferente do fix/carteira)
- ✅ Pode mexer em: `App.tsx`, `arena/**`, `api/client.ts`
- ✅ Foco: arquivos de i18n, config de países, câmbio, monólito

### 0.3 Ordem de Implementação
```
7.2 (Câmbio Real) → 7.1 (Expandir Países) → 7.5 (PIX) → 7.4 (Vazamento) → 7.3 (Catálogos)
    ↓                    ↓                     ↓            ↓                ↓
  Base                Config                Depósito     Arena/App        Refactor
```

**Justificativa da Ordem**:
1. **7.2 primeiro**: Maior visibilidade para usuário (ARS defasado), já tem infraestrutura
2. **7.1 depois**: Expande países usando dados corretos de câmbio
3. **7.5**: Depende de 7.1 (países corretos) para gerar instruções certas
4. **7.4**: Limpa vazamentos usando estruturas de 7.1
5. **7.3**: Refactor grande, deixar pro final quando sistema estiver estável

---

## 1. Mapeamento dos Problemas

### 7.1 — Cobertura de Países: Apenas 6

**Estado Atual**:
```javascript
// packages/shared/src/types.ts
PHASE2_COUNTRIES = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE']

// Default de cadastro SEM país
// dev-live-feed.mjs ~l.61 e ~l.836
country: 'ES' // ❌ Espanha como default
```

**Problema**:
- Qualquer país LATAM fora dos 6 cai em `es-MX` sem moeda/fuso próprios
- Default `'ES'` (Espanha) é incorreto para plataforma LATAM
- Faltam: UY, PY, BO, EC, VE, GT, DO, CR, HN, NI, PA, SV (12+ países)

**Países LATAM Alvo (18 total)**:
| País | Código | Moeda | População | Prioridade |
|------|--------|-------|-----------|------------|
| Brasil | BR | BRL | 215M | ✅ Implementado |
| México | MX | MXN | 128M | ✅ Implementado |
| Argentina | AR | ARS | 45M | ✅ Implementado |
| Colômbia | CO | COP | 51M | ✅ Implementado |
| Chile | CL | CLP | 19M | ✅ Implementado |
| Peru | PE | PEN | 33M | ✅ Implementado |
| Venezuela | VE | VES | 28M | 🟡 Alta prioridade |
| Equador | EC | USD | 18M | 🟡 Alta (usa USD) |
| Guatemala | GT | GTQ | 18M | 🟢 Média |
| Bolívia | BO | BOB | 12M | 🟢 Média |
| República Dominicana | DO | DOP | 11M | 🟢 Média |
| Honduras | HN | HNL | 10M | 🟢 Média |
| Paraguai | PY | PYG | 7M | 🟢 Média |
| Nicarágua | NI | NIO | 7M | 🟢 Baixa |
| El Salvador | SV | USD | 6M | 🟢 Baixa (usa USD) |
| Costa Rica | CR | CRC | 5M | 🟢 Baixa |
| Panamá | PA | USD | 4M | 🟢 Baixa (usa USD) |
| Uruguai | UY | UYU | 3M | 🟢 Baixa |

### 7.2 — Taxas de Câmbio Fixas no Front

**Estado Atual**:
```javascript
// apps/web/src/i18n/index.tsx:361-366
const EXCHANGE_RATES = {
  BRL: 5.50,   // ❌ Taxa fixa
  MXN: 19.50,  // ❌ Taxa fixa
  COP: 4150,   // ❌ Taxa fixa
  ARS: 980,    // ❌ Taxa fixa (real já > 1.000!)
  CLP: 940,    // ❌ Taxa fixa
  PEN: 3.75    // ❌ Taxa fixa
}
```

**Infraestrutura Existente (PARADA)**:
- ✅ Tabela `display_currencies` no Postgres (migration 0020)
- ✅ `services/api/src/services/exchange-rates.ts`: `ExchangeRateService`
- ✅ Rota `GET /api/v1/currencies` pronta
- ❌ Nenhum job atualiza a tabela
- ❌ `services/api` não roda em produção
- ❌ Front ignora tudo isso e usa tabela fixa

**Plano de Correção (3 Peças)**:
1. **Atualizador no monólito** (`dev-live-feed.mjs`):
   - `setInterval` de 5-10 min
   - Busca USD→BRL/MXN/COP/ARS/CLP/PEN em fonte externa
   - Grava no Postgres + Redis
   - Fontes gratuitas: `economia.awesomeapi.com.br`, `frankfurter.app`, `open.er-api.com`
   
2. **Endpoint no monólito** `GET /api/currencies`:
   - Retorna `{ code, rate, updated_at }[]`
   - `updated_at` permite ao front mostrar "cotação de 14:35"
   
3. **Front consome endpoint**:
   - react-query com refetch a cada 5 min
   - Fallback para tabela fixa se API falhar

**Regras de Segurança Financeira**:
- ✅ Taxa é **APENAS para EXIBIÇÃO**
- ✅ Saldo real continua em USD (minor units)
- ❌ NUNCA usar taxa de exibição para depósito/saque/stake/payout
- ✅ Depósito/saque em moeda local: taxa própria, travada, gravada na transação
- ✅ Fallback em camadas: Redis → Postgres → memória → estática

### 7.3 — i18n por Ternário Inline

**Métricas Coletadas**:
| Métrica | Valor |
|---|---|
| Chaves por catálogo de locale | ~110 |
| Chamadas `t()` no app | 24 |
| Ternários `pt`/`es` inline | 109 |
| Strings hardcoded em JSX | 156 |

**Arquivos com mais strings hardcoded**:
- `TournamentsPage` (43 strings)
- `SettingsPage` (34 strings)
- `PreviewHub` (33 strings)

**Problema**: 
- Manutenção fragmentada (mesma string em N lugares)
- Dificulta adicionar novos idiomas
- Risco de inconsistência

### 7.4 — Vazamento de Idioma Cruzado

**PT fixo exibido a ES**:
- Arena: `'Você'`, "Índice de Volatilidade", "Sala Bronze/Prata/Ouro", "Clássico"
- Localizações: `arena/engine.ts`, `arena/use-arena.ts`

**ES fixo exibido a PT**:
- `App.tsx` ~l.201: `¡Ganaste!` / `Perdiste`
- Mensagens servidor: "Saldo insuficiente", "Termina en", "Finalizado"
- Traders mood: `Compra`/`Venta` (deveria ser Compra/Venda em PT)

### 7.5 — Payload PIX para Todos os Países

**Problema**:
```javascript
// dev-live-feed.mjs ~l.1666
// Gera PIX para QUALQUER país e método (CARD/CRYPTO/BANK)
BR.GOV.BCB.PIX … BINMAX LTDA SAO PAULO
```

**Correção**:
- PIX apenas para: `country === 'BR' && method === 'PIX'`
- Outros países: instruções específicas por método

---

## 2. Arquitetura da Correção

### 2.1 Princípios
1. **Dados Reais**: Câmbio atualizado automaticamente de fontes confiáveis
2. **Cobertura Completa**: Todos os países LATAM com moeda/fuso corretos
3. **Segurança Financeira**: Taxa de exibição ≠ taxa de transação
4. **Resiliência**: Fallbacks em camadas (API → cache → estático)
5. **Retrocompatibilidade**: Usuários existentes continuam funcionando

### 2.2 Fontes de Câmbio (2 fontes para validação cruzada)

**Fonte Primária**: `economia.awesomeapi.com.br/json/last/USD-BRL,USD-MXN,USD-COP,USD-ARS,USD-CLP,USD-PEN`
- Gratuita, sem chave
- Atualização: a cada 30 segundos
- Formato: `{ "USDBRL": { "bid": "5.45", "ask": "5.46", ... } }`

**Fonte Secundária**: `frankfurter.app/latest?from=USD&to=BRL,MXN,COP,ARS,CLP,PEN`
- Banco Central Europeu (BCE)
- Gratuita, sem chave
- Formato: `{ "rates": { "BRL": 5.45, ... } }`

**Validação Cruzada**:
- Se diferença > 5%: mantém última taxa boa + alerta
- Se ambas falharem: fallback para Postgres → memória → estática

### 2.3 Fluxo de Atualização de Câmbio

```
┌─────────────────────────────────────────┐
│ setInterval (5 min) no dev-live-feed.mjs│
└───────────────┬─────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────┐
│ 1. Fetch fonte primária (AwesomeAPI)     │
│ 2. Fetch fonte secundária (Frankfurter)  │
│ 3. Validação cruzada (diff < 5%)         │
└───────────────┬───────────────────────────┘
                │
                ▼
        ┌───────┴────────┐
        │   Válido?      │
        └───┬────────┬───┘
            │ Sim    │ Não
            ▼        ▼
    ┌───────────┐  ┌──────────────┐
    │ 4. Grava  │  │ 5. Mantém    │
    │ Postgres  │  │ última boa   │
    │ + Redis   │  │ + Alerta     │
    └─────┬─────┘  └──────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Front refetch a cada 5 min              │
│ GET /api/currencies                      │
│ Fallback: Redis → PG → mem → estático   │
└─────────────────────────────────────────┘
```

---

## 3. Subetapas Detalhadas

### Subetapa 1 — 7.2: Câmbio Real (ALTO)
**Arquivo**: `01-SUBETAPA-7.2-CAMBIO-REAL.md`
- Atualizador no monólito (5 min interval)
- Endpoint `/api/currencies` no monólito
- Front consome com react-query
- Fallbacks em camadas
- **Estimativa**: 3-4h

### Subetapa 2 — 7.1: Expandir Países (ALTO)
**Arquivo**: `02-SUBETAPA-7.1-EXPANDIR-PAISES.md`
- Adicionar 12 países em `PHASE2_COUNTRIES`
- `CURRENCY_CONFIGS` para VE, EC, GT, BO, etc
- `COUNTRY_TIMEZONES` completo
- Default de cadastro por geolocalização ou escolha
- **Estimativa**: 2-3h

### Subetapa 3 — 7.5: PIX Correto (MÉDIO)
**Arquivo**: `03-SUBETAPA-7.5-PIX-CORRETO.md`
- Condicional: `country === 'BR' && method === 'PIX'`
- Instruções específicas por país/método
- **Estimativa**: 1h

### Subetapa 4 — 7.4: Vazamento de Idioma (MÉDIO)
**Arquivo**: `04-SUBETAPA-7.4-VAZAMENTO-IDIOMA.md`
- Arena: usar catálogos pt/es
- App.tsx: mensagens de resultado localizadas
- Traders mood: pt vs es
- **Estimativa**: 2h

### Subetapa 5 — 7.3: Migrar para Catálogos (MÉDIO)
**Arquivo**: `05-SUBETAPA-7.3-MIGRAR-CATALOGOS.md`
- Mover 109 ternários para catálogos
- Mover 156 strings hardcoded
- Unificar `es-*` em `es` base com overrides
- **Estimativa**: 4-5h (grande refactor)

---

## 4. Riscos e Mitigações

### Risco 1: Fonte de câmbio indisponível
**Impacto**: Taxa de exibição fica defasada  
**Mitigação**: 2 fontes + fallbacks (Redis → PG → mem → estático)  
**Aceitável**: Taxa estática melhor que erro 500

### Risco 2: Taxa de exibição usada em transação
**Impacto**: 🔴 CRÍTICO — Arbitragem contra a casa  
**Mitigação**: Code review rigoroso, nunca usar `EXCHANGE_RATES` em stake/payout  
**Verificação**: Grep por uso de taxa fora de exibição

### Risco 3: Migration 0020 não aplicada
**Impacto**: Tabela `display_currencies` não existe  
**Mitigação**: Verificar antes de rodar atualizador  
**Rollback**: Fallback para taxa estática

### Risco 4: Default 'ES' para usuários existentes
**Impacto**: Usuários sem país ficam com Espanha  
**Mitigação**: Migration para corrigir usuários `country = 'ES'` que não são da Espanha  
**Heurística**: Se `country = 'ES'` e idioma é `es-MX/CO/AR/etc`, corrigir para país provável

---

## 5. Cronograma Estimado

| Subetapa | Tempo Estimado | Dependências |
|----------|----------------|--------------|
| Subetapa 1 (7.2 Câmbio) | 3-4h | Nenhuma |
| Subetapa 2 (7.1 Países) | 2-3h | Subetapa 1 (usa taxas reais) |
| Subetapa 3 (7.5 PIX) | 1h | Subetapa 2 (países corretos) |
| Subetapa 4 (7.4 Vazamento) | 2h | Subetapa 2 (estruturas prontas) |
| Subetapa 5 (7.3 Catálogos) | 4-5h | Todas anteriores |
| Testes + Verificações | 2h | Todas as subetapas |
| **Total** | **14-17h** | — |

---

## 6. Verificações Finais Obrigatórias

### 6.1 Grep Final: Taxa de Câmbio
```bash
# Verificar que taxa de exibição não é usada em transações
grep -rn "EXCHANGE_RATES" --include="*.ts" --include="*.tsx" --include="*.mjs" | grep -i "stake\|payout\|deposit\|withdraw"
# Esperado: ZERO resultados (apenas em exibição de saldo)
```

### 6.2 Teste Manual: Câmbio Real
```bash
# 1. Verificar endpoint
curl http://localhost:3001/api/currencies

# Esperado:
# [
#   { "code": "BRL", "rate": 5.45, "updated_at": "2026-10-15T17:30:00Z" },
#   { "code": "MXN", "rate": 19.80, "updated_at": "2026-10-15T17:30:00Z" },
#   ...
# ]
```

### 6.3 Teste Manual: Países Expandidos
```bash
# Verificar que países novos estão no config
grep -o "'[A-Z][A-Z]'" packages/shared/src/types.ts | sort -u | wc -l
# Esperado: 18 (todos os países LATAM)
```

---

## 7. Entregáveis Finais

### 7.1 Commits (5-6)
1. `feat(i18n): real-time exchange rates from external sources`
2. `feat(i18n): expand LATAM countries from 6 to 18`
3. `fix(deposits): PIX instructions only for Brazil`
4. `fix(i18n): remove language leakage in arena and results`
5. `refactor(i18n): migrate inline ternaries to catalogs` (opcional se tempo permitir)

### 7.2 Testes (5 arquivos)
- `tests/unit/exchange-rates.test.mjs`
- `tests/unit/countries-config.test.mjs`
- `tests/unit/pix-instructions.test.mjs`
- `tests/unit/language-leakage.test.mjs`
- `tests/integration/i18n-e2e.test.mjs`

### 7.3 Relatório Final
- `docs/fix-i18n-latam/RELATORIO-FINAL.md`
- Diff por commit
- Como testar manualmente cada correção
- Riscos e rollback de cada commit

---

## 8. Aprovação Humana

Este plano deve ser aprovado antes de iniciar qualquer implementação.

**Aprovador**: Brendan (usuário)  
**Status**: ⏳ Pendente de aprovação  
**Data de Aprovação**: _____________________

**Após aprovação**, prosseguir para:
1. Criar 5 documentos MD de subetapa (01 a 05)
2. Implementar Subetapa 1 (7.2 — Câmbio Real)
3. Validar 100% → Commit
4. Implementar Subetapa 2 (7.1 — Expandir Países)
5. ... e assim por diante

---

**FIM DO PLANO GERAL**
