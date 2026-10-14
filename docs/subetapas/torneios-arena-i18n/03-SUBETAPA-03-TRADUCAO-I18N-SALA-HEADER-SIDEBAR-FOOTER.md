# Subetapa 03 — Tradução Reativa (i18n PT-BR ↔ ES) na Sala de Trading, Header, Sidebar, Footer e Layout Secundário

> **Agentes Alocados**: `surgical-frontend-agent`, `frontend-realtime-agent`, `binmax-brand-agent`, `chief-visual-director`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `shell-i18n-reactivity.unit.test.tsx`: 7/7 passed)

---

## 1. Objetivo da Subetapa
Resolver a primeira metade do problema **"2 - Não está ocorrendo tradução"**:
Quando o usuário seleciona **`PT` (`pt-BR`)** ou **`ES` (`es-ES`, `es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE`)** no seletor de idioma do topo ([`LanguageSelectorDropdown.tsx`](../../../apps/web/src/components/header/LanguageSelectorDropdown.tsx)), toda a casca da Sala de Trading e páginas secundárias deve traduzir instantaneamente sem exigir reload e sem quebrar nenhum teste unitário legado!

### Regra Crítica de Compatibilidade com Testes Legados (`09-ai-failure-map` + `19-testes-de-regressao-visual`)
- Em [`apps/web/src/i18n/index.tsx:369`](../../../apps/web/src/i18n/index.tsx#L369), quando um componente é renderizado fora do `<I18nProvider>` (como nos testes unitários legados `traderoom-*.unit.test.tsx`), `useTranslation()` retorna `locale: 'es-ES'`.
- Portanto:
  - Quando `locale` começa com `'pt'` (`locale === 'pt-BR'`), exibir os textos em **Português**.
  - Quando `locale` começa com `'es'` (incluindo o fallback default `'es-ES'` fora do provider), exibir exatamente os textos em **Espanhol Neutro** que os testes unitários legados já validam!
  - Isso garante **100% de tradução reativa para o usuário real** (que está dentro do `<I18nProvider>` em `main.tsx`) e **0% de quebra nos testes unitários existentes**!

---

## 2. Componentes Cobertos Passo a Passo

### Passo 3.1 — Dicionário e Helper Reativo de Tradução da Casca (`useTranslation`)
- Expandir os arquivos de locale [`apps/web/src/i18n/locales/pt-BR/common.json`](../../../apps/web/src/i18n/locales/pt-BR/common.json) e [`apps/web/src/i18n/locales/es-MX/common.json`](../../../apps/web/src/i18n/locales/es-MX/common.json) e [`apps/web/src/i18n/index.tsx`](../../../apps/web/src/i18n/index.tsx) com todas as chaves da sala.
- Garantir que `I18nProvider` respeite o idioma salvo pelo usuário em `localStorage` (`binmax_locale` / `platform-locale`) e atualize todos os assinantes de `useTranslation()` imediatamente ao trocar entre `PT` e `ES` no `LanguageSelectorDropdown`.

### Passo 3.2 — Tradução Reativa em [`SidebarDock.tsx`](../../../apps/web/src/components/sidebar/SidebarDock.tsx)
- Itens do menu lateral (`PT` ↔ `ES`):
  - `Operar` ↔ `Operar`
  - `Portfólio` ↔ `Portafolio`
  - `Histórico` ↔ `Historial`
  - `Torneios` ↔ `Torneos`
  - `Arena` ↔ `Arena`
  - `Análises` ↔ `Análisis`
  - `Tutoriais` ↔ `Tutoriales`
  - `Promoções` ↔ `Promociones`
  - `Ajustes` ↔ `Ajustes`
- Gavetas laterais de Portfólio e Histórico (`Portfólio total` ↔ `Portafolio total`, `Histórico de trading` ↔ `Historial de trading`, `Sem operações fechadas ainda` ↔ `Sin operaciones cerradas aún`, `ACIMA`/`ABAIXO` ↔ `SUBE`/`BAJA`, `Fechar painel` ↔ `Cerrar panel`).

### Passo 3.3 — Tradução Reativa em [`TerminalHeader.tsx`](../../../apps/web/src/components/header/TerminalHeader.tsx) e [`AccountSelectorDropdown.tsx`](../../../apps/web/src/components/header/AccountSelectorDropdown.tsx)
- `Conta de prática` ↔ `Cuenta de práctica`
- `Conta real` ↔ `Cuenta real`
- `Recarregar prática` / `Recarregar` ↔ `Recargar práctica` / `Recargar`
- `Depositar` ↔ `Depositar`
- `Entrar` ↔ `Iniciar sesión`
- `Criar conta` ↔ `Crear cuenta`
- `Sair` ↔ `Salir` / `Cerrar sesión`
- `Buscar ativo...` ↔ `Buscar activo...`

### Passo 3.4 — Tradução Reativa em [`TerminalFooter.tsx`](../../../apps/web/src/components/footer/TerminalFooter.tsx), [`PortfolioDrawer.tsx`](../../../apps/web/src/components/drawer/PortfolioDrawer.tsx), [`OrderTicket.tsx`](../../../apps/web/src/trade/OrderTicket.tsx) e [`SecondaryLayout.tsx`](../../../apps/web/src/components/layout/SecondaryLayout.tsx)
- `TerminalFooter.tsx`:
  - `Portfólio total` ↔ `Portafolio total`
  - `Lucro de hoje` ↔ `Ganancia de hoy`
  - `Operações abertas` ↔ `Operaciones abiertas`
  - `Hora atual:` ↔ `Hora actual:`
  - `Suporte 24/7` ↔ `Soporte 24/7`
  - Aviso regulatório D8 traduzido conforme idioma selecionado.
- `PortfolioDrawer.tsx`:
  - `ativas` ↔ `activas`, `Lucro potencial` ↔ `Ganancia potencial`, `Terminal em espera` ↔ `Terminal en espera`, `Mostrar posições` ↔ `Mostrar posiciones`.
- `OrderTicket.tsx`:
  - `Valor` ↔ `Monto`, `Expiração` ↔ `Expiración`, `Lucro` ↔ `Ganancia`, `ACIMA` ↔ `SUBE`, `ABAIXO` ↔ `BAJA`.
- `SecondaryLayout.tsx`:
  - Links de navegação (`Sala de Trading`, `Torneios` ↔ `Torneos`, `Arena Blitz`, `Análises` ↔ `Análisis`, `Tutoriais` ↔ `Tutoriales`, `Promoções` ↔ `Promociones`), botões de conta e rodapé.

---

## 3. Especificação de Testes Obrigatórios da Subetapa 03
Arquivo de teste: `apps/web/src/i18n/shell-i18n-reactivity.unit.test.tsx`

1. **Testes Unitários Bilíngues (PT-BR e ES-ES)**:
   - Renderizar `SidebarDock`, `TerminalHeader`, `AccountSelectorDropdown`, `TerminalFooter`, `PortfolioDrawer`, `OrderTicket` e `SecondaryLayout` dentro de `<I18nProvider initialLocale="pt-BR">` e verificar que todos os textos visíveis estão em Português.
   - Alternar via `setLocale('es-ES')` / `LanguageSelectorDropdown` e verificar que todos os textos mudam imediatamente para Espanhol sem desmontar a árvore.
   - Alternar de volta para `pt-BR` e verificar restauração imediata em Português.
2. **Teste de Estresse (Stress Test)**:
   - 300 trocas consecutivas de locale (`pt-BR` → `es-ES` → `es-MX` → `pt-BR`) com componentes montados — tempo de execução $< 500\text{ms}$, zero memory leak, zero dessincronização entre `localStorage` e DOM.
3. **Teste de Segurança (Security Test)**:
   - Tentativa de injetar locale inválido ou payload XSS em `localStorage.setItem('binmax_locale', '<script>alert(1)</script>')` — o `I18nProvider` sanitiza e cai no fallback seguro (`pt-BR` ou `es-ES`).
4. **Teste de Caos (Chaos Test)**:
   - Chave de tradução ausente ou parâmetros de interpolação `undefined`/`null` — nunca renderiza `undefined`, `[object Object]` ou quebra a árvore React.
5. **Verificação de Regressão**:
   - 100% dos testes unitários existentes (`traderoom-*.unit.test.tsx`) continuam passando sem alteração.
