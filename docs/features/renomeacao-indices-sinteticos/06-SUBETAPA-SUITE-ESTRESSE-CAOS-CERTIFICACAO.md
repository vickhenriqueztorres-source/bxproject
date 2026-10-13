# SUBETAPA 06: Bateria Integral de Estresse, Caos, FMEA e Certificação Final

> **Status:** HOMOLOGADO E APROVADO (GATE 6 PASS)  
> **Responsáveis:** `qa-resilience-agent`, `financial-correctness-reviewer`, `post-implementation-verifier`  
> **Skills Chave:** `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  

---

## 1. Escopo Técnico e Invariantes

1. **Execução de Baterias de Testes Ponta a Ponta**:
   - Criação e execução do script de certificação institucional `tests/test-synthetic-rename-certification.mjs`.
   - Teste de fluxo completo: geração de tick estocástico -> agregação de vela -> distribuição WebSocket -> abertura de ordem UP/DOWN -> liquidação determinística contra o tick oficial -> conciliação de saldo.
2. **Cenários de Caos e Alta Carga**:
   - Churn de conexões WebSocket com inscrições rápidas nos novos índices canônicos (`VOL_10`, `VOL_25`, `VOL_50`, `VOL_75`, `VOL_100`, `CRASH_BOOM_100`).
   - Saturação de ordens concorrentes em menos de 100ms (burst de 30 ordens simultâneas aprovado com 0 rejeições).
   - Validação de invariantes financeiras I-01 e I-02 (saldo disponível e reservado).
3. **Auditoria de Conformidade e Relatório de Homologação**:
   - Emissão do relatório final de certificação assinado pela mesa de especialistas.

---

## 2. Passo a Passo de Implementação

1. [x] Escrever script `tests/test-synthetic-rename-certification.mjs`.
2. [x] Executar suíte de testes unitários e de integração existentes para comprovar ausência de regressão.
3. [x] Executar teste de carga e burst concorrente com os 6 novos índices sintéticos.
4. [x] Validar retrocompatibilidade total com clientes legados (`SYNTH_*`).
5. [x] Gerar relatório final de homologação.

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite | Resultado |
|---|---|---|---|---|
| **T-CERT-01** | **Fluxo Completo de Trading** | Abrir ordem em novo índice e conferir liquidação e saldo | Liquidação precisa, saldo creditado/debitado conforme resultado, zero float leaks. | ✅ APROVADO |
| **T-CERT-02** | **Estresse e Burst de Ordens** | Disparo de 30 ordens simultâneas em paralelo nos 6 índices | 100% de aceitação HTTP 201 com latência ultra-baixa sem lock contention. | ✅ APROVADO |
| **T-CERT-03** | **Caos de Rede & Churn WS** | Múltiplas conexões concorrentes assinando e desinscrevendo | Streaming contínuo de ticks estocásticos entregue para todos os 6 ativos. | ✅ APROVADO |
| **T-CERT-04** | **Certificação Dual-Alias Legado** | Varredura de fallback para os 6 símbolos legados `SYNTH_*` | 100% de compatibilidade em REST e WebSocket sem quebra de chaves estrangeiras. | ✅ APROVADO |

---

## 4. Gate de Homologação da Subetapa 06

- [x] `tests/test-synthetic-rename-certification.mjs` executou com status `SUCCESS` em todos os 6 índices.
- [x] Testes de regressão das Subetapas 01 a 05 todos validados com sucesso.
- [x] A visualização no navegador reflete com precisão a nova nomenclatura e o trading opera de ponta a ponta.
- [x] **Subetapa 06 e Feature 100% HOMOLOGADA PARA PRODUÇÃO.**
