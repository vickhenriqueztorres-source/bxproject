# Subfase 7: Bateria Exaustiva de Testes, Caos & Carga

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `qa-resilience-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Suporte a Defeitos:** `bug-fix-agent`  
**Subtasks do PRD:** T15, T16, T17, T18  
**Decisões Aplicadas:** D-14 (Prometheus, Grafana, Loki), D-15 (Docker Compose), D-19 (Payout D-19)  
**Invariantes Chave:** Q-01 a Q-05, QA-01 a QA-14, C-01 a C-10, O-01 a O-06  

---

## 1. Escopo e Objetivos da Subfase
Validar exaustivamente todos os subsistemas da plataforma sob condições extremas de estresse, concorrência, caos de infraestrutura e sobrecarga de tráfego. Executar testes estatísticos de aleatoriedade criptográfica, simulações de Monte Carlo, estresse concorrente no teto de solvência de 3% de float, auditorias contábeis no Blnk Ledger, cenários de caos com injeção de falhas (morte de processos líderes, partições de rede, clock skew) e testes de carga k6 com centenas de clientes simultâneos. Integrar tudo no pipeline de CI/CD automatizado via script `gate.sh`.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 7.1: Testes Matemáticos e Estatísticos (NIST SP 800-22 & Monte Carlo)
- **Ação:** Criar a suíte estatística em `tests/math/`:
  - `nist-entropy.test.ts`:
    - Coleta 10.000.000 de números gerados pelo Box-Muller sobre CSPRNG em `services/tick-engine`.
    - Executa baterias de Frequency Monobit Test, Block Frequency Test e Runs Test.
    - *Critério de Aceite:* $p\text{-value} > 0.01$ comprovando ausência de viés ou previsibilidade criptográfica.
  - `monte-carlo-ou.test.ts`:
    - Simula 1.000 trajetórias estocásticas de 100.000 ticks cada sob o modelo Ornstein-Uhlenbeck.
    - Avalia a convergência para o preço base $\mu$ e cálculo da variância empírica.
    - *Critério de Aceite:* Zero ocorrência de cotações negativas, zero explosão exponencial e desvio padrão contido na faixa teórica.
  - `arithmetic-precision.test.ts`:
    - Testa 500.000 comparações de cotações decimais fixas garantindo que o empate (`DRAW`) ocorra perfeitamente sem falhas de ponto flutuante IEEE-754.
- **Regras:** `M-01`, `B-02`, QA-05.
- **Critério de Aceite:** Todas as suites matemáticas passam com aprovação estatística formal.

---

### Passo 7.2: Teste de Estresse de Concorrência Extrema (The Flashmob Attack no Float Cap)
- **Ação:** Criar `tests/integration/flashmob-risk-cap.test.ts`:
  - Cenário de Teste:
    - Plataforma configurada com Float Total de US$ 10.000,00 (`1_000_000` centavos).
    - Teto de risco de 3% para a vela: US$ 300,00 (`30_000` centavos).
    - Cada aposta de US$ 10,00 (`1_000` centavos) com payout de 85% gera risco de US$ 8,50 (`850` centavos).
    - Capacidade máxima teórica da vela na mesma direção: $\lfloor 30000 / 850 \rfloor = 35$ ordens.
    - Disparo simultâneo via script concorrente de **500 requisições `POST /contracts` (CALL) disparadas dentro da mesma janela de 10 milissegundos**.
  - Verificação:
    - Exatamente 35 requisições retornam HTTP `201 Created`.
    - 465 requisições retornam HTTP `422 Unprocessable Entity` com código de erro `RISK_CAP_EXCEEDED`.
    - Consulta atômica no Redis confirma que o risco acumulado na chave da vela nunca ultrapassou US$ 300,00 em nenhum instante de tempo.
- **Regras:** `05-resilience-patterns`, Gestão de Risco Pré-Ordem.
- **Critério de Aceite:** Zero race condition; a solvência da corretora é mantida mesmo sob ataque coordenado de bots.

---

### Passo 7.3: Auditoria Contábil de Dupla Entrada no Blnk Ledger
- **Ação:** Criar `tests/integration/blnk-accounting-audit.test.ts`:
  - Execução controlada de 100 contratos finalizados em `WIN`, 100 contratos em `LOSS` e 100 contratos em `DRAW`:
    - No WIN: audita se `user:reserved` zerou, `user:available` recebeu `stake + profit` e `house_payout` debitou o lucro exato.
    - No LOSS: audita se `user:reserved` zerou e `house_revenue` creditou 100% da stake.
    - No DRAW: audita se `user:reserved` devolveu 100% da stake para `user:available` sem afetar as contas da casa.
    - Confere a equação fundamental do Blnk Ledger:
      $$\sum \text{Débitos} - \sum \text{Créditos} = 0$$
  - Teste de Replay de Idempotência:
    - 10 requisições simultâneas com a mesma `Idempotency-Key` resultam em exatamente 1 reserva no Blnk.
    - Injeção da mesma mensagem de liquidação 5 vezes gera apenas 1 crédito de payout no Blnk.
- **Regras:** `I-01` a `I-04`, `B-03`, `B-04`.
- **Critério de Aceite:** O livro-razão mantém balanço contábil exato e nenhuma duplicação de saldo ocorre.

---

### Passo 7.4: Testes de Caos de Infraestrutura (C-01 a C-10)
- **Ação:** Criar a suíte de caos em `tests/chaos/`:
  - **C-01 (Morte do Líder do Tick Engine):**
    - Envia `kill -9` no processo do líder enquanto ticks estão sendo gerados.
    - Confere se o nó secundário assume via lease no Redis em $\le 600\text{ms}$ e retoma a geração do tick seguinte com `sequence + 1` sem buracos na série temporal.
  - **C-02 (Queda do PostgreSQL durante a Geração):**
    - Simula falha no PostgreSQL durante o ciclo de gravação do tick.
    - Confere que nenhum tick incompleto ou fantasma é publicado no Redis Streams ou Pub/Sub.
  - **C-03 (Partição de Rede no Redis por 5 segundos):**
    - Injeta latência infinita via Toxiproxy no Redis.
    - Confere se os ticks continuam sendo persistidos no PostgreSQL e, na volta do Redis, o Outbox Relay descarrega a fila com sucesso.
  - **C-04 (Clock Skew no Settlement Worker):**
    - Simula adiantamento de 1.500ms no relógio do container do settlement.
    - Confere que o worker entra em modo de espera e recusa-se a liquidar a ordem enquanto o tick correspondente a $ts \ge \text{expires\_at}$ não for oficialmente comitado no PostgreSQL.
  - **C-05 (Crash do Settlement Worker no Meio do Processamento):**
    - Mata o worker imediatamente após ler a ordem e antes de liquidar.
    - Confere que a ordem permanece no Redis Sorted Set e é recuperada por outro worker sem virar um contrato zumbi.
- **Regras:** `05-resilience-patterns`, `07-production-operations`, Q-03.
- **Critério de Aceite:** Todos os cenários de caos recuperam automaticamente sem corrupção de saldo ou inconsistência de mercado.

---

### Passo 7.5: Testes de Carga de Alta Concorrência (k6 - T18)
- **Ação:** Criar o script de carga `tests/load/k6-broker-load.js`:
  - Cenário de Carga:
    - 300 conexões WebSocket ativas simultâneas recebendo ticks em tempo real a cada 250ms por 30 minutos contínuos.
    - Ingress contínuo de 50 novas ordens de contratos por minuto distribuídas entre os usuários.
  - Medição de Métricas (Thresholds de Reprovação):
    - Latência de matching pré-ordem na API: $p95 < 5\text{ms}$ e $p99 < 10\text{ms}$.
    - Taxa de erro HTTP 5xx: $< 0.01\%$.
    - Taxa de perda de mensagens WebSocket: $0\%$.
    - Consumo de memória e CPU do WebSocket Gateway estável (zero vazamento de memória).
  - Pós-Condição:
    - Executa o Reconciliador Financeiro no final do teste: deve reportar exatamente zero divergência contábil entre o PostgreSQL e o Blnk Ledger.
- **Regras:** `06-testing-quality`, Q-04.
- **Critério de Aceite:** O teste de carga atinge todos os thresholds e a integridade da plataforma é preservada sob estresse contínuo.

---

### Passo 7.6: Automação do Quality Gate e CI/CD (`docs/fase-1/scripts/gate.sh`)
- **Ação:** Configurar e executar o pipeline completo de validação:
  - Execução dos gates sequenciais:
    - `gate.sh T01..T18 impl`: compilação TypeScript limpa e linter sem warnings.
    - `gate.sh T01..T18 qa`: execução de todas as suites de testes unitários, de integração, de caos e de carga.
    - `gate.sh T01..T18 review`: auditoria dos revisores financeiro e de segurança contra as listas de verificação.
    - `gate.sh T01..T18 final`: consolidação dos relatórios de evidências em YAML e comprovação de critérios de aceite atendidos.
  - Validação de logs estruturados e métricas no Prometheus (`metrics.json`).
- **Regras:** `07-production-operations`, O-01, O-02.
- **Critério de Aceite:** O script de gate roda de ponta a ponta e emite veredito formal `ALL GATES PASSED`.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Todos os 10 milhões de números do CSPRNG passam nos testes de entropia NIST.
2. O teste Flashmob prova a inviolabilidade do teto de 3% de float sob ataque concorrente.
3. Cenários de caos C-01 a C-05 passam com recuperação automática comprovada.
4. Teste de carga k6 atinge $p95 < 5\text{ms}$ e zero divergência no Blnk Ledger.
5. Gate final da Fase 1 marcado como `PASS`.
