# Subetapa 7: Bateria Institucional de Estresse, Carga, Caos & Certificação Final (E1 a E4)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação dos Testes:** `qa-resilience-agent`  
**Revisão Arquitetural:** `broker-architect-agent`  
**Revisão Financeira (E3):** `financial-correctness-reviewer`  
**Segurança & Anti-Tampering:** `security-reviewer`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-01 a V-13 Completa)  
**Status:** EM HOMOLOGAÇÃO INSTITUCIONAL DO GATE FINAL

---

## 1. Visão Geral e Protocolo de Execução

Esta etapa executa a validação definitiva de capacidade, estabilidade, integridade estocástica e conformidade contábil da plataforma sob condições extremas de estresse e caos.
O protocolo segue rigorosamente as diretrizes das Skills `05-resilience-patterns`, `06-testing-quality` e `10-post-implementation-verification`:
- **Ambiente Descartável**: Todos os testes executam em bancos e instâncias Redis isolados e descartáveis. Ticks e livros contábeis jamais são apagados em ambiente real (`I-01`).
- **Usuários Virtuais Autênticos**: Cada VU do k6 possui identidade individual e tokens Keycloak válidos.
- **Limites de Transporte**: Máximo de 5 conexões por usuário e 10 pares por conexão no WebSocket.

---

## 2. Os 6 Passos de Execução da Subetapa 7

1. **Passo 1 (Degrau E1: Ramp N_max e Estabilidade Monotônica)**:
   Executar rampa progressiva de 36 $\to$ 50 $\to$ 75 $\to$ 100 ativos a 1 tick/s cada por 10 minutos (2 min warmup + 8 min estável). Avaliar cadência $\ge 0{,}9$ tick/s por ativo, zero gaps $> 3$ s e ausência de saltos na `sequence`.
2. **Passo 2 (Degrau E2: WS Fan-out e Latência Tick-to-Client)**:
   Com 36 ativos gerando ticks, submeter o Gateway a 500 $\to$ 2.000 clientes simultâneos via WebSocket, com 4 ativos subscritos por cliente. Medir latência $p95 \le 500$ ms e validar barramento de de-duplicação.
3. **Passo 3 (Degrau E3: Pico Financeiro com 50 ordens/s e Barreira Anti-Cross)**:
   Disparar rajadas de 50 `POST /contracts`/s distribuídas pelos 36 ativos com liquidação após 60s. Verificar $p95 \le 300$ ms, $p99 \le 800$ ms, taxa de erro $< 0{,}1\%$, zero contratos cruzados e soma contábil do Blnk $= 0$.
4. **Passo 4 (Degrau E4: Injeção de Caos C-01 e C-05 sob Pico)**:
   - Injetar `C-01` (kill do líder do Tick Engine): novo líder deve ser eleito via Redis Lease em $\le 3$ s sem perder ticks.
   - Injetar `C-05` (reinício abrupto do Redis): os serviços devem reconectar e realizar catch-up pelo PostgreSQL sem perda de continuidade.
5. **Passo 5 (Auditoria Matemática e Estatística Completa)**:
   Executar testes de física estocástica (`arithmetic-precision.test.ts`, `monte-carlo-ou.test.ts`, `nist-entropy.test.ts`):
   - Prova de Martingale: média de retornos em 60s dentro do intervalo de confiança de zero.
   - Detecção exata de empates (DRAW) em 50.000 amostras com aritmética inteira `*_minor`.
   - Teste de entropia CSPRNG Box-Muller NIST SP 800-22 ($p > 0{,}01$).
6. **Passo 6 (Emissão do Veredito Oficial pelo Verificador)**:
   O `post-implementation-verifier` executa `tests/test-multi-post-verifier.mjs` e as consultas SQL/Redis formais das pós-condições V-01 a V-13, gerando o relatório final homologado.

---

## 3. Matriz de Reprovação de Degraus (Critérios Eliminatórios)

Qualquer degrau é **sumariamente REPROVADO** se violar:
1. **Taxa de Ticks**: $< 0{,}9$ tick/s em qualquer par ou intervalo $> 3$ s entre ticks na janela estável.
2. **Sequência**: $\max(\text{sequence}) - \min(\text{sequence}) + 1 \ne \text{count}(*)$ (lacunas ou saltos).
3. **Liderança**: Mais de 1 líder simultâneo por símbolo ou oscilação constante.
4. **Outbox**: Lag $> 5$ s ou tick do Stream defasado em mais de 2 s do banco.
5. **WebSocket**: Latência $p95 > 500$ ms ou mais de 5 conexões ativas por usuário no cluster.
6. **Contratos**: `POST /contracts` $p95 > 300$ ms ou erro 5xx $> 0{,}1\%$.
7. **Anti-Cross**: Qualquer contrato liquidado com tick de símbolo divergente (**Tolerância Zero**).
8. **Blnk Ledger**: Divergência contábil de saldo $\ne 0$.

---

## 4. Garantias Pós-Implementação (Skill 10: Matriz Completa V-01 a V-13)

| Garantia | Descrição | Método de Prova |
| :---: | :--- | :---: |
| **V-01** | Catálogo de ativos idêntico ao esperado; precisão decimal imutável | SQL `indices` |
| **V-02** | `sequence` contínua por ativo, começando em 1, alinhada com `index_state` | SQL `ticks` |
| **V-03** | Cadência $\ge 0{,}9$ tick/s por ativo; zero intervalos $> 3$ s | SQL `ticks` na janela |
| **V-04** | Cadeia de hash SHA-256 íntegra desde a gênese em todos os pares | SQL `ticks` |
| **V-05** | Outbox publicado em $\le 5$ s; Stream Redis alinhado com Postgres | SQL + Redis Stream |
| **V-06** | Candles fechados idênticos ao recálculo dos ticks | SQL `candles` vs `ticks` |
| **V-07** | Zero contratos cruzados; resultado recalculado confere 100% | SQL `contracts` |
| **V-08** | Todo contrato vence e liquida em $\le 10$ s após `expires_at` | SQL `contracts` |
| **V-09** | Reconciliação Blnk `OK` com divergência 0; payouts estritamente consistentes | SQL `reconciliation_runs` |
| **V-10** | Ativo `PAUSED` recusa novos contratos e liquida os abertos | SQL `contracts` |
| **V-11** | Limites WebSocket (5 conexões/sub, 10 ativos/conexão, zero buracos) | Teste de unidade / gateway |
| **V-12** | SLOs dos degraus de carga atendidos pelos thresholds do k6 | JSON export k6 |
| **V-13** | Integridade do verificador: zero arquivos de teste ou produção modificados no gate | Fingerprint SHA-256 |

---

## 5. Critérios de Passagem do Quality Gate 7 (Homologação Final)
- Executar `node tests/test-multi-07-institutional-suite.mjs` $\to$ Exit Code 0.
- Executar `npx tsx --test tests/chaos/C-01-max-pairs.test.ts` $\to$ Exit Code 0.
- Executar `npx tsx --test tests/math/*.test.ts` $\to$ Exit Code 0.
- Executar `node tests/test-multi-post-verifier.mjs` $\to$ Exit Code 0 (13/13 garantias aprovadas).
- Emissão do relatório oficial de aprovação pelo `post-implementation-verifier`.
