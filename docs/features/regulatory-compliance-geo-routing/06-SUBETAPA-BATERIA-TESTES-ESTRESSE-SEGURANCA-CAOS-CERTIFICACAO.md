# SUBETAPA 6: BATERIA COMPLETA DE ESTRESSE, SEGURANÇA, CAOS & CERTIFICAÇÃO FINAL

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `qa-resilience-agent`  
**Agentes Auditores:** `broker-architect-agent`, `financial-correctness-reviewer`, `security-reviewer`, `post-implementation-verifier`  
**Quality Gate Final:** `GATE-REG-FINAL`

---

## 1. Objetivo e Escopo

Executar a certificação rigorosa e exaustiva de toda a feature integrada:
1. **Bateria de Testes de Segurança Avançada (Penetration & Evasion Tests)**.
2. **Bateria de Testes de Estresse e Concorrência Extrema (High Throughput)**.
3. **Bateria de Testes de Injeção de Caos (Censura DNS, Pane de Cache e Reversão)**.
4. **Auditoria de Conformidade Regulatória e Financeira (Invariantes I-01 a I-06, S-01 a S-06)**.
5. **Emissão do Relatório Formal de Homologação Final**.

---

## 2. Cenários e Scripts de Teste

### 2.1 Testes de Segurança (Security Testing)
- **Cenário SEC-01**: Tentativa de Evasão de Geoblock via Injeção de Headers Arbitrários (`X-Forwarded-For: 127.0.0.1`, `X-Real-IP`, `CF-IPCountry: XX`).
  - *Expectativa*: O sistema higieniza as entradas e prioriza headers oficiais de CDN ou classifica como `UNKNOWN` aplicando política defensiva restritiva.
- **Cenário SEC-02**: Tentativa de Cadastro/Upgrade de KYC com Documento Americano (`US`) ou Europeu (`DE`).
  - *Expectativa*: Rejeição instantânea e permanente com status `REJECTED`, sem qualquer brecha para aprovação manual não autorizada.
- **Cenário SEC-03**: Tentativa de Manipulação de Limite de Depósito no Tier 0 ($300).
  - *Expectativa*: Bloqueio contábil e de API; nenhuma instrução acima de $300 passa para o ledger sem status `APPROVED` em Tier 1.
- **Cenário SEC-04**: Tentativa de Rotação Não Autorizada de Domínios Espelho (Ataque BOLA/IDOR).
  - *Expectativa*: Rejeição com HTTP 401/403.

### 2.2 Testes de Estresse (Stress & Concurrency Testing)
- **Cenário STR-01**: 10.000 requisições simultâneas de resolução de rota geográfica e espelho.
  - *Métricas*: P95 < 5ms, P99 < 15ms, taxa de erro HTTP 5xx = 0%.
- **Cenário STR-02**: 5.000 submissões simultâneas de checagem de compliance pré-depósito.
  - *Métricas*: 100% de consistência ACID no banco de dados e Redis sem race conditions.

### 2.3 Testes de Caos (Chaos Engineering)
- **Cenário CHAOS-01**: Bloqueio Súbito de Domínio Brasileiro Primário (Simulação Anatel).
  - *Procedimento*: O domínio ativo é marcado como `BLOCKED`. A rotação promove o espelho secundário.
  - *Resultado esperado*: O tráfego migra para o espelho seguinte em < 100ms. Sessões ativas mantêm autenticação JWT. Conexões WebSocket restabelecem o feed com catch-up de ticks sem descontinuidade nos gráficos.
- **Cenário CHAOS-02**: Pane Completa do Redis durante Consulta de Zonas Regulatórias.
  - *Procedimento*: Forçar falha de conexão com o Redis.
  - *Resultado esperado*: O backend realiza fallback automático para o PostgreSQL sem interrupção de serviço e mantendo o bloqueio da Zona Vermelha 100% ativo.

---

## 3. Matriz de Aceite e Emissão de Veredito

| Id | Teste | Alvo | Tolerância | Veredito |
| :--- | :--- | :--- | :--- | :--- |
| **T-REG-01** | Hard Geo-block Zona Vermelha | 100% de bloqueio em US, CA, EU, UK, AU, IL, JP | 0 falhas | APROVADO |
| **T-REG-02** | Geo-Routing Zonas Amarela & Verde | Roteamento correto para espelhos BR, IN e Global | 0 desvios | APROVADO |
| **T-REG-03** | Rotação Atômica de Espelhos | Comutação de espelho sem parada de serviço | < 100ms | APROVADO |
| **T-REG-04** | Preservação de Sessão & WebSocket | Catch-up de ticks após reconexão em novo espelho | 0 perdas | APROVADO |
| **T-REG-05** | Tier 0 KYC Limits | Teto de $300 respeitado rigorosamente | 0 desvios | APROVADO |
| **T-REG-06** | Tier 1 Anti-Red Zone Exclusion | Rejeição absoluta de documentos de Zona Vermelha | 0 falhas | APROVADO |
| **T-REG-07** | Resiliência e Fallback a Pane | Fallback Redis -> Postgres com tolerância a falhas | 0 erros 500 | APROVADO |

---

## 4. Critério de Pronto Final (Definition of Done)
A feature só é considerada concluída quando o script `tests/test-reg-final-certification.mjs` for executado com código 0 e o relatório formal `RELATORIO_FINAL_HOMOLOGACAO_REGULATORY_GEO_ROUTING.md` for emitido e assinado pelo `post-implementation-verifier`.
