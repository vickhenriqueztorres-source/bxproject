# Subetapa 03: Bateria de Certificação, Estresse, Caos, Segurança e Não-Regressão

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agente de Testes**: `qa-resilience-agent`  
> **Revisor de Compliance e Risco**: `compliance-risk-reviewer`  
> **Guardião de Regressão**: `regression-guardian-agent`  
> **Skills**: `06-testing-quality`, `02-financial-invariants`, `05-resilience-patterns`, `19-testes-de-regressao-visual`  

---

## 1. Objetivo Técnico
Submeter as alterações a uma rigorosa bateria de testes de estresse de redimensionamento, simulação de caos operacional (disparos rápidos em boleta compacta), verificação de invariantes financeiras invioláveis (preservação exata do valor de `stake_minor`, ausência de drifting de centavos) e execução de 100% da suíte de testes Vitest do projeto para garantir zero regressão funcional.

---

## 2. Passo a Passo de Implementação dos Testes
1. Criar a suíte de testes abrangente:
   - Arquivo: `apps/web/src/chart/subetapa-03-caos-estresse-responsivo.unit.test.tsx`
2. Cenários a cobrir:
   - **Cenário 1 (Estresse de Viewport)**: Renderizar o terminal completo em viewports verticais restritos (alturas de 600px, 700px, 800px, 900px e 1080px) simulando `PortfolioDrawer` aberto.
   - **Cenário 2 (Caos de Operações Simultâneas)**: Simular disparos de ordens em 4 células paralelas de grid 2x2 com a boleta compacta, confirmando que cada payload mantém seu símbolo, direção e stake intactos.
   - **Cenário 3 (Segurança Financeira)**: Testar seleção dos presets `10`, `50`, `100`, `500` e conferir que o valor em centavos enviado ao backend é rigorosamente `1000`, `5000`, `10000`, `50000` (sem floats ou desvios).
   - **Cenário 4 (Prevenção de Duplo Clique)**: Testar o travamento do estado `busy` e `executingRef` na boleta compacta para impedir duplo disparo sob latência.
   - **Cenário 5 (Validação Cruzada)**: Executar todos os testes do monorepo relacionados a boleta, gráficos e layout.

---

## 3. Critério de Aceite da Subetapa 03 e Conclusão do Gate
- Todos os testes da suíte `subetapa-03-caos-estresse-responsivo.unit.test.tsx` passam com 100% de sucesso.
- A suíte global do frontend roda e passa com zero falhas.
- O resultado visual comprovado elimina o scrollbar feio e mantém a TradeRoom 100% encaixada e responsiva.
