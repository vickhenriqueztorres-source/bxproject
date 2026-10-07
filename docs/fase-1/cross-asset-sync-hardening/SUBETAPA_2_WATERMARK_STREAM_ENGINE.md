# Subetapa 2: Motor de Watermark (Bounded Out-of-Orderness)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes:** M-02 (Monotonicidade temporal), V-02 (Consistência de stream)

---

## 1. Escopo e Objetivos da Subetapa
Implementar o padrão fundamental de processamento de streams (Apache Flink / Beam): **Watermark com bounded out-of-orderness**. O watermark representa o marco temporal $W$ que declara formalmente: *"o sistema já processou e conhece todos os eventos de mercado até o instante $W$"*. Ticks que cheguem com $event\_time < W$ são classificados como **dados tardios (*late data*)** e não podem ser utilizados para cotação em tempo real ou arbitragem.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 2.1: Definição da Tolerância Máxima de Desalinhamento ($\Delta_{skew}$)
- **Ação:** Configurar a constante `WATERMARK_DELAY_MS = 2000` (2 segundos de tolerância para jitter de rede e filas).
- **Critério de Aceite:** Equilíbrio ótimo entre prontidão de resposta e tolerância a atrasos de rede.

### Passo 2.2: Algoritmo de Cálculo de Watermark Global e por Ativo
- **Ação:** No motor de stream:
  $$W_{symbol}(t) = \max_{seen}(event\_time) - \Delta_{skew}$$
  $$W_{global}(t) = \min_{active\_symbols}(W_{symbol})$$
- **Critério de Aceite:** O watermark avança de forma monotonicamente não-decrescente.

### Passo 2.3: Classificação de Ticks (On-Time vs Late Data)
- **Ação:** Para cada tick recebido:
  * Se $event\_time \ge W$: tick classificado como `ON_TIME` e aceito normalmente.
  * Se $event\_time < W$: tick classificado como `LATE_DATA`.
- **Critério de Aceite:** Nenhum tick tardio mascara o preço atual do ativo.

### Passo 2.4: Descarte Seguro e Auditoria de Dados Tardios
- **Ação:** Ticks `LATE_DATA` não alteram o `last_price` de negociação ativa no `index_state`. São registrados apenas para agregação analítica com flag `is_late: true`.
- **Critério de Aceite:** Zero regressão do preço corrente por pacotes antigos que chegaram atrasados da rede.

### Passo 2.5: Exposição de Watermark no Endpoint de Estado
- **Ação:** O endpoint `GET /api/v1/snapshot` e o frame WebSocket de heartbeat incluem o `watermark_ts` corrente do ativo e do sistema.
- **Critério de Aceite:** Clientes sabem exatamente até qual momento o estado está consolidado.

### Passo 2.6: Contador Acumulado de Ticks Tardios
- **Ação:** Incrementar o contador `late_ticks_total{symbol}` sempre que um evento chegar após a linha d'água.
- **Critério de Aceite:** Rastreabilidade imediata de rotas de rede degradadas.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Avanço Monotônico do Watermark:** O watermark nunca diminui, mesmo se chegarem ticks fora de ordem.
2. **Teste de Rejeição de Late Data:** Injetar tick com $event\_time$ anterior ao watermark e confirmar que não substitui o preço atual.
3. **Teste de Resiliência sob Jitter:** Simular chegada intercalada de eventos e comprovar estabilidade do stream.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- Watermark calculado continuamente com monotonicidade estrita comprovada.
- Ticks tardios neutralizados sem corromper cotação viva.
- Testes automatizados executados e 100% aprovados.
