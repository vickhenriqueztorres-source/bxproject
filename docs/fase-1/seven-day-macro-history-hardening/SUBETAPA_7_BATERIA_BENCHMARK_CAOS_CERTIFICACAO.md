# Subetapa 7: Bateria de Benchmark k6, Estresse, Caos e Certificação Final

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `qa-resilience-agent`  
**Auditor e Verificador Pós-Implementação:** `post-implementation-verifier` (Skill 10: V-04, V-05, V-06, V-11, V-13)  
**Agente Revisor:** `broker-architect-agent` & `security-reviewer`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-05 (Isolamento de Ativos) | V-06 (Conformidade Ticks x Candles) | V-11 (Resiliência do Feed) | V-13 (Integridade da Suíte)

---

## 1. Escopo e Objetivos da Subetapa

Executar a certificação rigorosa e automatizada comprovando que:
1. O backend sustenta 7 dias completos (10.080 minutos) para todos os 36 ativos.
2. A rota `/candles` entrega timeframes agregados (5m = 2.016 barras, 15m = 672 barras) com latência p95 $< 10\text{ms}$.
3. O resampler no cliente processa a semana inteira em $< 2\text{ms}$.
4. A navegação macro de 7 dias opera a 60 FPS estáveis sem engasgos de memória.
5. Os Quality Gates são homologados com 100% de conformidade.

---

## 2. A Suíte de Testes Automatizada: `tests/test-seven-day-macro-history.mjs`

```text
[Bateria de Certificação: Histórico Macro de 7 Dias & Alta Velocidade]
  ├── Teste 1: Capacidade de 10.080 Minutos (7 Dias Contínuos) no Seed e Ring Buffer
  ├── Teste 2: Agregação Multi-Timeframe no Backend (5m = 2.016 barras / 15m = 672 barras)
  ├── Teste 3: Benchmark de Latência e Throughput (500 requisições simultâneas com p95 < 10ms)
  ├── Teste 4: Prefetch Preditivo Antecipado no Scroll (Zero Lacunas e Zero Sobreposição)
  ├── Teste 5: Micro-Benchmark do Resampler no Frontend (10.080 para 5m em < 2ms)
  └── Teste 6: Janela Deslizante de 3.500 Barras no Canvas (Heap Estável e 60 FPS)
```

### Detalhamento dos Testes:

### Teste 1: Capacidade de 10.080 Minutos (7 Dias Contínuos)
* **Verificação:** `GET /candles?symbol=SYNTH_VOL_50&limit=10080`.
* **Critério:** Retorno de exatamente 10.080 barras cobrindo uma semana inteira ($604.740\text{ segundos}$ entre a primeira e a última barra), respeitando monotonicidade estrita.

### Teste 2: Agregação Multi-Timeframe no Backend
* **Verificação:** `GET /candles?symbol=EURUSD_OTC&interval=5m&limit=2016`.
* **Critério:** Retorno de 2.016 barras com OHLC matematicamente congruente com os blocos de 5 minutos da série de 1 minuto.

### Teste 3: Benchmark de Latência e Throughput
* **Verificação:** Disparo concorrente de 500 requisições de fatias de 7 dias com limites variados.
* **Critério:** 100% das requisições respondem com status 200 e latência p95 $< 15\text{ms}$.

### Teste 4: Prefetch Preditivo no Scroll
* **Verificação:** Simulação de scroll onde cada lote de 1.000 barras é requisitado com antecedência e mesclado sem quebrar a ordenação temporal.
* **Critério:** Zero duplicatas e delta temporal estritamente uniforme de 60 segundos.

### Teste 5: Micro-Benchmark de CPU do Resampler
* **Verificação:** Medir tempo de processamento em loop de 10.080 barras convertidas para 5m.
* **Critério:** Tempo de CPU $< 2.0\text{ms}$ por execução.

### Teste 6: Janela Deslizante de 3.500 Barras
* **Verificação:** Simulação de injeção de 10.080 barras com o filtro de corte ativo.
* **Critério:** O array resultante contém rigorosamente até 3.500 barras preservando os pontos visíveis.

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

Executar o comando de certificação:
```bash
node tests/test-seven-day-macro-history.mjs
```
O script deve finalizar com `Exit Code 0` e confirmação formal:
```text
🎉 QUALITY GATE DO HISTÓRICO MACRO DE 7 DIAS 100% HOMOLOGADO E APROVADO!
```
