# Subetapa 03: Bateria de Testes Integrados de Caos, Estresse e Não-Regressão

**Responsável:** `qa-resilience-agent` & `regression-guardian-agent`  
**Revisor:** `broker-architect-agent` & `compliance-risk-reviewer`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS — SÓ VAI PRA PRÓXIMA SE ESTIVER 100% VALIDADA"

---

## 1. Escopo de Validação
Esta subetapa valida simultaneamente:
1. Os gráficos separados funcionando em paralelo (até 6 gráficos simultâneos no modo 3x2).
2. Ausência total de velas desproporcionais, gaps ou gráficos microscópicos em todas as transições de ativos e grades.
3. Consumo de memória sob controle, sem vazamentos de event listeners ou contextos WebGL.
4. Preservação de 100% dos 312 testes legados do projeto.

---

## 2. Passo a Passo de Execução

### Passo 1: Criação da Suíte de Caos e Estresse Multi-Gráficos
- **Arquivo**: `apps/web/src/chart/multichart-chaos-stress.unit.test.tsx`
- **Casos de Teste Obrigatórios**:
  - `CHAOS-01`: 6 gráficos com símbolos heterogêneos (Forex, Cripto, Commodities, Sintéticos) recebendo rajadas de 1.000 ticks concorrentes sem intercâmbio de preços (Cross-Asset Leakage = 0).
  - `CHAOS-02`: Comutação contínua de layout (1x1 -> 2x1 -> 2x2 -> 3x2 -> 1x1) durante recebimento de ticks sem vazamento de memória ou quebra do DOM.
  - `CHAOS-03`: Simulação de tick nulo, tick NaN, timestamp reverso e preço zero — os gráficos devem descartar anomalias sem quebrar.
  - `CHAOS-04`: Teste de escala instantânea: troca imediata de BTCUSD ($64.000) para EURUSD (1.0850) validando que as velas ocupam a proporção correta da tela (sem colapso vertical).

### Passo 2: Execução da Suíte Completa de Testes
- Executar `npx vitest run apps/web`.
- Garantir que todos os 312 testes originais + todos os novos testes passem com 0 falhas.
