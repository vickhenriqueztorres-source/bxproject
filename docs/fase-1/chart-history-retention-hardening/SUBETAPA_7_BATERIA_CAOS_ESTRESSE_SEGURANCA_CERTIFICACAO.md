# Subetapa 7: Bateria de Caos, Estresse, Segurança e Certificação Final do Quality Gate

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `qa-resilience-agent`  
**Auditor e Verificador Pós-Implementação:** `post-implementation-verifier` (Skill 10: V-04, V-05, V-06, V-11, V-13)  
**Agente Revisor:** `broker-architect-agent` & `security-reviewer`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-05 (Isolamento de Ativos) | V-06 (Conformidade Ticks x Candles) | V-11 (Resiliência do Feed) | V-13 (Integridade da Suíte)

---

## 1. Escopo e Objetivos da Subetapa

Executar a bateria definitiva de certificação para comprovar matematicamente e por execução real que:
1. O perigo de truncamento em 2 horas foi completamente erradicado.
2. A plataforma suporta carregamento e navegação de 24 a 48 horas de histórico com alta performance.
3. Não há vazamento de memória no cliente nem no servidor.
4. O Quality Gate de Retenção Histórica é homologado com 100% de sucesso.

---

## 2. A Suíte de Testes Automatizada: `tests/test-chart-history-hardening.mjs`

A suíte cobre 6 verificações rigorosas:

```text
[Bateria de Certificação: Retenção Histórica & Paginação de Velas]
  ├── Teste 1: Capacidade do Ring Buffer e Profundidade do Seed Inicial (1.440 a 2.880 barras)
  ├── Teste 2: Paginação Retroativa Monotônica via Query Parameter 'before' (Zero Sobreposição)
  ├── Teste 3: Estresse de Concorrência e Throughput (200 requisições simultâneas com p95 < 15ms)
  ├── Teste 4: Segurança, Sanitização Estrita e Proteção Anti-DoS (limit e before maliciosos)
  ├── Teste 5: Caos de Rede, Queda e Recuperação do Feed (Reconstituição Monotônica)
  └── Teste 6: Janela Deslizante de Memória no Frontend (Cap de 3.000 barras / Heap Estável)
```

### Detalhamento dos 6 Testes:

### Teste 1: Capacidade do Ring Buffer e Seed Inicial (24h a 48h)
- **Procedimento:** Consultar `GET /candles?symbol=SYNTH_VOL_50&limit=1440` logo após a inicialização.
- **Asserções:**
  * O array retornado possui exatamente ou no mínimo 1.440 barras.
  * A diferença entre o timestamp da última vela e da primeira vela é de pelo menos $1.439 \times 60 = 86.340\text{ segundos}$ ($23\text{h}59\text{m}$).
  * Todas as velas respeitam $\text{low} \le \min(\text{open}, \text{close})$ e $\text{high} \ge \max(\text{open}, \text{close})$.

### Teste 2: Paginação Retroativa Monotônica via `before`
- **Procedimento:**
  1. Buscar Lote 1: `GET /candles?symbol=EURUSD_OTC&limit=300`.
  2. Extrair o timestamp mais antigo: $T_1 = \text{Lote1}[0].\text{time}$.
  3. Buscar Lote 2: `GET /candles?symbol=EURUSD_OTC&before=T_1&limit=300`.
  4. Extrair o timestamp mais antigo: $T_2 = \text{Lote2}[0].\text{time}$.
- **Asserções:**
  * Todas as velas do Lote 2 possuem $\text{time} < T_1$.
  * A junção dos lotes forma uma sequência estritamente crescente sem nenhum timestamp duplicado nem inversão temporal.

### Teste 3: Estresse de Concorrência e Throughput
- **Procedimento:** Disparar 200 requisições simultâneas em paralelo com valores randômicos de `before` e `limit` para múltiplos ativos.
- **Asserções:**
  * 100% das requisições respondem com status HTTP 200.
  * Latência média $< 10\text{ms}$; latência p95 $< 25\text{ms}$.
  * Zero vazamento de conexões ou erros de socket.

### Teste 4: Segurança e Proteção Anti-DoS
- **Procedimento:** Enviar payloads hostis:
  * `limit=999999999` $\to$ Forçado para o teto de 1.000 ou 2.880.
  * `limit=-50`, `limit=abc` $\to$ Sanitizado para default 500 ou HTTP 400.
  * `before=-1791330000`, `before="test';"` $\to$ Sanitizado ou HTTP 400.
  * `symbol=INVALID_SYMBOL_INJECTION` $\to$ HTTP 404 ou 400.
- **Asserções:**
  * O servidor não lança unhandled exceptions e a memória permanece estável.

### Teste 5: Caos de Reinício do Feed e Continuidade
- **Procedimento:** Reiniciar o feed durante o consumo de dados ao vivo e validar se a primeira vela gerada após o reinício conecta com a vela anterior.
- **Asserções:**
  * O relógio UTC não gera saltos de tempo e os hashes permanecem encadeados.

### Teste 6: Janela Deslizante de Memória no Frontend
- **Procedimento:** Simular injeção de 5.000 barras e validar o corte em `MAX_LOADED_BARS = 3000`.
- **Asserções:**
  * O tamanho final do array é exatamente 3.000 elementos.

---

## 3. Matriz de Garantias Pós-Implementação (Skill 10)

| Garantia | Descrição | Status Exigido |
|---|---|---|
| **`V-04`** | Agregação OHLCV Idempotente e Consistente | **`PASS`** |
| **`V-05`** | Isolamento Estrito de Ativos na API de Velas | **`PASS`** |
| **`V-06`** | Conformidade Absoluta entre Ticks e Velas | **`PASS`** |
| **`V-11`** | Resiliência de Conexão e Feed Monotônico | **`PASS`** |
| **`V-13`** | Zero Regressão na Suíte Geral de Testes | **`PASS`** |

---

## 4. Homologação do Quality Gate

Para declarar a conclusão formal da blindagem de retenção histórica:
```bash
node tests/test-chart-history-hardening.mjs
```
O script deve encerrar com `Exit Code 0` e a mensagem:
```text
🎉 QUALITY GATE DE RETENÇÃO HISTÓRICA 100% HOMOLOGADO E APROVADO!
```
