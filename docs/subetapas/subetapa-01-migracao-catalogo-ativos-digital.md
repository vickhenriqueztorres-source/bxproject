# Subetapa 01: Migração do Catálogo de Ativos de "Turbo" para "Digital"

> **Orquestrador**: `tech-lead-orchestrator`  
> **Especialista de Implementação**: `surgical-frontend-agent` (`cirurgiao`)  
> **Revisor Visual e Design Sênior**: `chief-visual-director` / `binmax-brand-agent`  
> **Revisor de Risco e Invariantes**: `compliance-risk-reviewer`  
> **Validador de Testes**: `qa-resilience-agent`  
> **Skills Ativas**: `01-project-context`, `11-chart-trading-tools`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Contexto e Objetivo Técnico
Substituir a denominação legada "Turbo" por **"Digital"** no Modal de Seleção de Ativos (`AssetCatalogModal.tsx`), espelhando a nomenclatura institucional moderna e profissional da plataforma (Opciones Digitales).

### Itens de Interface Alterados:
1. **Título do Cabeçalho do Modal**:
   - De: `Catálogo de Activos · Opciones Turbo`
   - Para: `Catálogo de Activos · Opciones Digitales`
2. **Subtítulo Institucional**:
   - Manter a clareza e promessa: `Selecciona un activo para operar con vencimiento rápido y payouts de hasta 85%` (ou vencimento dinâmico de opções digitais).
3. **Badges de Instrumento por Ativo na Lista**:
   - De: `<span ...>Turbo</span>`
   - Para: `<span ...>Digital</span>`
   - Manter contraste e proporção: `background: 'rgba(0, 229, 255, 0.12)'`, `color: '#00e5ff'`, `fontSize: '9px'`, `fontWeight: 700`.

---

## 2. Passo a Passo de Execução Cirúrgica
1. **Modificar `apps/web/src/components/modals/AssetCatalogModal.tsx`**:
   - Atualizar a tag `<h2>` do cabeçalho para `Catálogo de Activos · Opciones Digitales`.
   - Atualizar o badge ao lado do símbolo de cada ativo na lista de `Turbo` para `Digital`.
2. **Atualizar Suíte de Testes Existente**:
   - Arquivo: `apps/web/src/trade/asset-catalog-modal.unit.test.tsx`
   - Atualizar asserção `AC-01` para verificar `Catálogo de Activos · Opciones Digitales`.
   - Adicionar asserção explícita de presença da badge `Digital` em cada linha de ativo renderizada.
3. **Executar Verificação**:
   - Rodar `npx vitest run apps/web/src/trade/asset-catalog-modal.unit.test.tsx`.
   - Certificar 100% de sucesso.

---

## 3. Critérios de Aceite e Gate da Subetapa 01
- [ ] O cabeçalho exibe rigorosamente "Catálogo de Activos · Opciones Digitales".
- [ ] Todos os ativos do catálogo renderizam a badge "Digital" com estilo ciano sem quebra de alinhamento visual.
- [ ] Nenhum componente de estado, busca, favoritos ou filtro por categoria é afetado.
- [ ] 100% dos testes da suíte `asset-catalog-modal.unit.test.tsx` passam no Vitest.
