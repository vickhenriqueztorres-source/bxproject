# Subetapa 02: Sincronização do Terminal Header e Seletor do Gráfico com "Digital"

> **Orquestrador**: `tech-lead-orchestrator`  
> **Especialista de Implementação**: `surgical-frontend-agent` (`cirurgiao`)  
> **Revisor Visual e Design Sênior**: `chief-visual-director` / `binmax-brand-agent`  
> **Revisor de Risco e Invariantes**: `compliance-risk-reviewer`  
> **Validador de Testes**: `qa-resilience-agent`  
> **Skills Ativas**: `01-project-context`, `11-chart-trading-tools`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Contexto e Objetivo Técnico
Garantir a consistência semântica e visual em toda a experiência de trading, atualizando os pontos periféricos onde o rótulo "Turbo" era exibido:
1. **Abas do Header (`TerminalHeader.tsx`)**: No subtítulo de cada aba de ativo ativo/inativo que não possua trade aberta, o texto abaixo do símbolo exibia `Turbo` ao lado do payout. Deve exibir **`Digital`**.
2. **Badge In-Chart no Gráfico (`PriceChart.tsx`)**: No topo esquerdo do gráfico, o pill institucional ao lado do par exibia `Turbo`. Deve exibir **`Digital`**.
3. **SidebarDock (`SidebarDock.tsx`)**: No item educacional 1, atualizar o texto "Opciones Turbo: Cómo Operar SUBE y BAJA" para "Opciones Digitales: Cómo Operar SUBE y BAJA".

---

## 2. Passo a Passo de Execução Cirúrgica
1. **Modificar `apps/web/src/components/header/TerminalHeader.tsx`**:
   - Linha ~399: Alterar o texto `<span ...>Turbo</span>` para `<span ...>Digital</span>`.
2. **Modificar `apps/web/src/chart/PriceChart.tsx`**:
   - Linha ~883: Alterar o badge no seletor in-chart de `Turbo` para `Digital`.
3. **Modificar `apps/web/src/components/sidebar/SidebarDock.tsx`**:
   - Linha ~660: Atualizar de "1. Opciones Turbo: Cómo Operar SUBE y BAJA" para "1. Opciones Digitales: Cómo Operar SUBE y BAJA".
4. **Atualizar/Validar Suítes de Testes**:
   - `apps/web/src/trade/in-chart-asset-selector.unit.test.tsx`
   - `apps/web/src/trade/subetapa-01-asset-tab-card-scale.unit.test.tsx`
5. **Executar Verificação**:
   - Rodar Vitest para os testes do header e gráfico.

---

## 3. Critérios de Aceite e Gate da Subetapa 02
- [ ] O header exibe "Digital" sob o par da aba quando não há trade aberta.
- [ ] O seletor superior esquerdo do gráfico exibe o badge "Digital" com verde institucional `#22C47A`.
- [ ] O menu lateral educacional referencia "Opciones Digitales".
- [ ] Todos os testes unitários de header e in-chart passam com 100% de sucesso.
