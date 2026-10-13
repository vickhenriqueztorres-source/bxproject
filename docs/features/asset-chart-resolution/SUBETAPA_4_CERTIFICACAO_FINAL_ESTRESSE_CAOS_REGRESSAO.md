# SUBETAPA 4: Certificação Final de Estresse, Caos, Segurança e Regressão

> **Data:** 08/10/2026  
> **Status:** PLANEJADO  
> **Responsáveis:** `qa-resilience-agent`, `compliance-risk-reviewer`, `tech-lead-orchestrator`  

---

## 1. Escopo e Objetivos da Certificação

A **Subetapa 4** consolida todas as correções anteriores em uma bateria rigorosa de testes ponta a ponta:
1. **Estresse Operacional:** Comutação ultrarrápida entre dezenas de ativos sem memory leaks, sem acumulação de subscrições zumbis no `TradingFeedManager` e sem travamento na thread do Lightweight Charts.
2. **Caos de Rede e Desconexão:** Simulação de queda de WebSocket durante a troca de ativos, garantindo que o fallback de Ornstein-Uhlenbeck assuma sem tela preta e sem descontinuidade geométrica.
3. **Invariantes Financeiros:** Garantir que a troca de ativo atualize o preço de referência da boleta e os limites sem desvirtuar o cálculo de `stake_minor` ou `payout_minor`.
4. **Padrão Duas Portas:** Provar que com `NEW_TRADEROOM = false`, o comportamento legado clássico permanece 100% inalterado.

---

## 2. Matriz de Testes da Suíte de Certificação

Os testes serão implementados em `apps/web/src/trade/asset-chart-certification.unit.test.tsx`:

| Código | Matriz | Descrição do Teste | Critério de Aceite |
|---|---|---|---|
| **CRT-01** | **Estresse** | 100 trocas rápidas de ativos consecutivas via selector | Duração total < 200ms, sem vazamento de subscrições. |
| **CRT-02** | **Des-duplicação WS** | Múltiplas abas abertas para o mesmo ativo não multiplicam frames WS | Subscrição única mantida por símbolo no `TradingFeedManager`. |
| **CRT-03** | **Caos de Rede** | Queda forçada de conexão durante renderização ativa | Fallback estocástico assume sem gerar tela preta ou exceção. |
| **CRT-04** | **Segurança Financeira** | A troca de ativo não altera saldos nem afeta ordens em curso | Invariantes monetários estritamente preservados. |
| **CRT-05** | **Duas Portas** | Alternância da feature flag `NEW_TRADEROOM` | Flag OFF mantém terminal clássico; Flag ON ativa os seletores Turbo Prata. |

---

## 3. Critérios de Homologação Final

1. 100% dos testes da suíte `asset-chart-certification.unit.test.tsx` verdes.
2. Todas as suítes de teste de trading do projeto passando sem falhas.
3. Compilação TypeScript e build de produção (`pnpm --filter @broker/web build`) concluídos com código de saída 0.
4. Emissão do relatório formal final de homologação em `docs/relatorios/RELATORIO_FINAL_CORRECAO_GRAFICOS_E_SELETOR.md`.
