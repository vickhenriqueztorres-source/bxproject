# Subetapa 5 — 7.3: Migrar para Catálogos (MÉDIO — OPCIONAL)

**Branch**: `fix/i18n-latam`  
**Prioridade**: 🟡 MÉDIO (BAIXA se tempo acabar)  
**Estimativa**: 4-5 horas (GRANDE REFACTOR)  
**Dependências**: Todas as subetapas anteriores  
**Status**: ⚠️ OPCIONAL — Implementar apenas se tempo permitir

---

## 0. Problema Atual

### 0.1 Métricas Coletadas (da Análise Original)
| Métrica | Valor |
|---|---|
| Chaves por catálogo de locale | ~110 |
| Chamadas `t()` no app | 24 |
| Ternários `pt`/`es` inline | **109** |
| Strings hardcoded em JSX | **156** |

**Arquivos com mais strings hardcoded**:
- `TournamentsPage.tsx` — 43 strings
- `SettingsPage.tsx` — 34 strings
- `PreviewHub.tsx` — 33 strings

### 0.2 Problema
```tsx
// Padrão repetido em 109 lugares:
{locale === 'pt-BR' ? 'Depósito' : 'Depósito'}
{locale.startsWith('pt') ? 'Saldo disponível' : 'Saldo disponible'}
<button>{lang === 'pt' ? 'Confirmar' : 'Confirmar'}</button>
```

**Impacto**:
- Manutenção fragmentada (mesma string em N lugares)
- Dificulta adicionar novos idiomas (precisa achar todos os ternários)
- Risco de inconsistência ("Depósito" em um lugar, "Depositar" em outro)
- Código poluído e ilegível

---

## 1. Solução: Migração Incremental

### 1.1 Estratégia
Não migrar tudo de uma vez (5h+ de trabalho). Fazer **por página**, priorizando as mais afetadas:

1. **Fase 1** (1h): TournamentsPage (43 strings)
2. **Fase 2** (1h): SettingsPage (34 strings)
3. **Fase 3** (1h): PreviewHub (33 strings)
4. **Fase 4** (2h): Restante (46 strings em ~10 arquivos)

### 1.2 Padrão de Migração
```tsx
// ANTES (ternário inline):
<button>
  {locale === 'pt-BR' ? 'Criar Torneio' : 'Crear Torneo'}
</button>

// DEPOIS (catálogo):
<button>{t('tournaments.createButton')}</button>
```

### 1.3 Adicionar Chaves nos Catálogos
**Arquivo**: `apps/web/src/i18n/locales/pt.json`

```json
{
  // Já existente (~110 chaves + ~15 da Subetapa 4 = 125)
  
  // ✅ ADICIONAR: Tournaments (43 strings)
  "tournaments.title": "Torneios",
  "tournaments.createButton": "Criar Torneio",
  "tournaments.joinButton": "Entrar",
  "tournaments.prizePool": "Prêmio Total",
  "tournaments.participants": "Participantes",
  "tournaments.endsIn": "Termina em",
  "tournaments.rules": "Regras",
  "tournaments.leaderboard": "Classificação",
  // ... (total ~43 chaves)
  
  // ✅ ADICIONAR: Settings (34 strings)
  "settings.title": "Configurações",
  "settings.profile": "Perfil",
  "settings.language": "Idioma",
  "settings.notifications": "Notificações",
  "settings.security": "Segurança",
  "settings.logout": "Sair",
  // ... (total ~34 chaves)
  
  // ✅ ADICIONAR: Preview (33 strings)
  "preview.title": "Pré-visualização",
  "preview.asset": "Ativo",
  "preview.direction": "Direção",
  "preview.amount": "Valor",
  "preview.duration": "Duração",
  // ... (total ~33 chaves)
}
```

**Arquivo**: `apps/web/src/i18n/locales/es.json`

```json
{
  // Espelhar todas as chaves PT em ES
  "tournaments.title": "Torneos",
  "tournaments.createButton": "Crear Torneo",
  "tournaments.joinButton": "Entrar",
  // ... etc
}
```

### 1.4 Migrar TournamentsPage (Fase 1)
**Arquivo**: `apps/web/src/pages/TournamentsPage.tsx`

**Passo 1 — Grep para encontrar ternários**:
```bash
grep -n "locale.*?" apps/web/src/pages/TournamentsPage.tsx
```

**Passo 2 — Substituir um por um**:
```tsx
// ANTES:
<h1>{locale === 'pt-BR' ? 'Torneios' : 'Torneos'}</h1>

// DEPOIS:
import { useTranslation } from '../i18n';

function TournamentsPage() {
  const { t } = useTranslation();
  
  return (
    <>
      <h1>{t('tournaments.title')}</h1>
      <button>{t('tournaments.createButton')}</button>
      <div>{t('tournaments.prizePool')}: {pool}</div>
      {/* ... continuar para todas as 43 strings */}
    </>
  );
}
```

**Passo 3 — Testar**:
```bash
# 1. Abrir página de torneios em PT
# 2. Verificar que todas as strings aparecem em PT
# 3. Trocar para ES
# 4. Verificar que todas as strings aparecem em ES
```

**Passo 4 — Commit incremental**:
```bash
git add apps/web/src/pages/TournamentsPage.tsx apps/web/src/i18n/locales/*.json
git commit -m "refactor(i18n): migrate TournamentsPage to catalogs (43 strings)"
```

### 1.5 Repetir para Outras Páginas
- **SettingsPage** (34 strings) → Commit separado
- **PreviewHub** (33 strings) → Commit separado
- **Outros** (46 strings em ~10 arquivos) → Commit separado

---

## 2. Unificar Locales ES-* em ES Base

### 2.1 Problema
```typescript
// Código atual tem:
'es-MX', 'es-CO', 'es-AR', 'es-CL', 'es-PE', 'es-VE', ...
// Mas catálogos são idênticos (exceto moeda/fuso)
```

### 2.2 Solução
**Arquivo**: `apps/web/src/i18n/index.tsx`

```typescript
// ANTES:
const catalogs = {
  'pt-BR': ptBR,
  'es-MX': esMX,
  'es-CO': esCO,
  'es-AR': esAR,
  // ... 12 arquivos ES quase idênticos
};

// DEPOIS:
const catalogs = {
  'pt-BR': ptBR,
  'pt': ptBR, // Fallback PT genérico
  
  'es': es, // Base ES (compartilhado por todos)
  
  // Overrides específicos apenas se necessário
  'es-AR': { ...es, ...esAROverrides }, // Ex: "vos" em vez de "tú"
};

function getCatalog(locale: string) {
  // Tentar locale específico primeiro
  if (catalogs[locale]) return catalogs[locale];
  
  // Fallback para idioma base
  const lang = locale.split('-')[0];
  return catalogs[lang] || catalogs['pt-BR']; // PT-BR como último fallback
}
```

**Benefício**:
- 1 arquivo `es.json` em vez de 12 quase idênticos
- Overrides apenas onde realmente diferem
- Manutenção muito mais simples

---

## 3. Checklist de Implementação

### Fase 1 — TournamentsPage (1h)
- [ ] Grep: Encontrar todos os ternários na página
- [ ] Adicionar ~43 chaves em `pt.json` e `es.json`
- [ ] Substituir todos os ternários por `t()`
- [ ] Testar em PT e ES
- [ ] Commit: `refactor(i18n): migrate TournamentsPage to catalogs`

### Fase 2 — SettingsPage (1h)
- [ ] Grep: Encontrar todos os ternários
- [ ] Adicionar ~34 chaves
- [ ] Substituir ternários
- [ ] Testar
- [ ] Commit: `refactor(i18n): migrate SettingsPage to catalogs`

### Fase 3 — PreviewHub (1h)
- [ ] Grep: Encontrar todos os ternários
- [ ] Adicionar ~33 chaves
- [ ] Substituir ternários
- [ ] Testar
- [ ] Commit: `refactor(i18n): migrate PreviewHub to catalogs`

### Fase 4 — Restante (2h)
- [ ] Grep: Encontrar ternários em outros arquivos
- [ ] Adicionar ~46 chaves
- [ ] Substituir ternários
- [ ] Testar
- [ ] Commit: `refactor(i18n): migrate remaining pages to catalogs`

### Fase 5 — Unificar ES (30min)
- [ ] Criar `es.json` base
- [ ] Remover `es-MX.json`, `es-CO.json`, etc (se existirem)
- [ ] Atualizar `getCatalog()` com fallback
- [ ] Testar todos os países ES
- [ ] Commit: `refactor(i18n): unify ES locales into base + overrides`

---

## 4. Testes Obrigatórios

### 4.1 Teste de Cobertura (Grep)
```bash
# Verificar quantos ternários ainda restam
grep -r "locale.*?" apps/web/src/ --include="*.tsx" | wc -l

# META:
# - Antes: 109 ternários
# - Depois: 0 ternários (todos em catálogos)
```

### 4.2 Teste de Paridade (Chaves)
```javascript
// Teste unitário: Verificar que PT e ES têm mesmas chaves
import pt from './locales/pt.json';
import es from './locales/es.json';

const ptKeys = Object.keys(pt).sort();
const esKeys = Object.keys(es).sort();

assert.deepStrictEqual(ptKeys, esKeys, 'PT and ES must have same keys');
```

### 4.3 Teste Manual (Cada Página)
```bash
# Para cada página migrada:
# 1. Abrir em PT-BR → Verificar strings
# 2. Trocar para ES-MX → Verificar strings
# 3. Trocar para ES-AR → Verificar strings
# 4. Verificar que nenhuma string aparece como "[key]" (chave faltando)
```

---

## 5. Estimativa de Tempo Total

| Fase | Tempo | Acumulado |
|------|-------|-----------|
| Fase 1: TournamentsPage | 1h | 1h |
| Fase 2: SettingsPage | 1h | 2h |
| Fase 3: PreviewHub | 1h | 3h |
| Fase 4: Restante (~10 arquivos) | 2h | 5h |
| Fase 5: Unificar ES | 30min | 5h30min |
| **Total** | **5h30min** | — |

**Decisão**: Se tempo acabar após Subetapa 4, **pular esta subetapa** e documentar no relatório final como "melhoria futura".

---

## 6. Critério de Decisão

### Implementar SE:
- ✅ Subetapas 1-4 foram concluídas com sucesso
- ✅ Tempo restante > 5h
- ✅ Nenhum bug crítico descoberto nas subetapas anteriores

### Pular SE:
- ❌ Tempo restante < 5h
- ❌ Bugs críticos precisam ser corrigidos primeiro
- ❌ Usuário prefere entregar 4 commits sólidos do que 5 commits apressados

---

## 7. Documentar se Pulado

Se esta subetapa for pulada, adicionar ao `RELATORIO-FINAL.md`:

```markdown
## 6. Melhorias Futuras Recomendadas

### 6.1 Migração de Ternários para Catálogos
**Status**: Não implementado (falta de tempo)  
**Impacto**: Baixo (sistema funciona corretamente, apenas código menos limpo)  
**Esforço**: 5-6 horas  

**Descrição**:
Ainda restam ~109 ternários inline do tipo:
```tsx
{locale === 'pt' ? 'Texto PT' : 'Texto ES'}
```

**Recomendação**:
Migrar incrementalmente, página por página:
1. TournamentsPage (43 strings)
2. SettingsPage (34 strings)
3. PreviewHub (33 strings)
4. Outros (46 strings)

**Benefício**:
- Código mais limpo
- Facilita adicionar novos idiomas (EN, FR, etc)
- Reduz risco de inconsistências
```

---

## 8. Aprovação para Implementar

**Status**: ⏳ Pendente (CONDICIONAL)  
**Aprovador**: Brendan  
**Data**: _______________

**Condições para implementar**:
1. Subetapas 1-4 concluídas com sucesso
2. Tempo restante > 5h
3. Aprovação explícita do usuário

**Se aprovado**:
1. Executar Fase 1 (TournamentsPage)
2. Commit incremental
3. Executar Fase 2 (SettingsPage)
4. Commit incremental
5. Executar Fase 3 (PreviewHub)
6. Commit incremental
7. Executar Fase 4 (Restante)
8. Commit incremental
9. Executar Fase 5 (Unificar ES)
10. Commit final: `refactor(i18n): complete migration to i18n catalogs`

**Se pulado**:
- Documentar como "melhoria futura" no relatório final
- Prosseguir para criar RELATORIO-FINAL.md

---

**FIM DA SUBETAPA 5 (OPCIONAL)**
