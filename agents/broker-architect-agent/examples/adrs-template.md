# Template de Registro de Decisão Arquitetural (ADR)

Este template é o formato padronizado utilizado pelo `broker-architect-agent` para formalizar decisões de arquitetura.

---

# ADR-[NUMERO]: [TITULO DA DECISAO]

- **Data:** [YYYY-MM-DD]
- **Status:** [PROPOSED | ACCEPTED | REJECTED | DEPRECATED | SUPERSEDED]
- **Autor / Arquiteto:** `broker-architect-agent`
- **Revisores:** `tech-lead-orchestrator`, `financial-correctness-reviewer`, `security-reviewer`

---

## 1. Contexto e Declaração do Problema
[Descrever o contexto de negócio, requisitos funcionais e não-funcionais (SLAs de latência, tolerância a falhas, conformidade contábil) e a dor enfrentada.]

---

## 2. Direcionadores da Decisão (Decision Drivers)
- [Direcionador 1: e.g., Latência pré-ordem sub-milissegundo]
- [Direcionador 2: e.g., Prevenção de insolvência por Flashmob attacks]
- [Direcionador 3: e.g., Contabilidade de dupla entrada em partidas dobradas]

---

## 3. Opções Consideradas
- **Opção 1:** [Descrição breve e por que foi descartada]
- **Opção 2:** [Descrição breve e por que foi descartada]
- **Opção 3 (Escolhida):** [Descrição da alternativa adotada]

---

## 4. Decisão Tomada
[Descrição técnica aprofundada da solução arquitetural adotada, contratos de dados, protocolos e garantias.]

---

## 5. Consequências e Trade-offs
### 5.1 Consequências Positivas
- [Benefício 1]
- [Benefício 2]

### 5.2 Consequências Negativas e Mitigações
- [Trade-off 1 e como mitigamos]
- [Trade-off 2 e como mitigamos]

---

## 6. Invariantes Protegidos
- [Invariantes do PRD afetados, e.g., I-01, M-01, B-08]
