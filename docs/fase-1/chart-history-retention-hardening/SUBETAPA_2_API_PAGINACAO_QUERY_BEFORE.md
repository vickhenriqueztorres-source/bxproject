# Subetapa 2: API REST /candles com Suporte a Paginação Retroativa (before, limit)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `security-reviewer`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `04-security-iam`, `05-resilience-patterns`  
**Invariantes:** V-05 (Isolamento Estrito de Ativos) | S-04 (Sanitização e Anti-BOLA) | R-03 (Timeout & Limites)

---

## 1. Escopo e Objetivos da Subetapa

Capacitar o endpoint `/candles` e `/api/candles` para permitir **paginação retroativa segura** via parâmetro `before`:
- Quando o usuário arrasta o gráfico para a esquerda (scroll para o passado), o cliente requisita o lote anterior de velas cuja estampa temporal seja inferior ao primeiro ponto visível na tela:
  $$\text{GET } /api/candles?\text{symbol}=\text{EURUSD\_OTC}\&\text{before}=1791330000\&\text{limit}=500$$
- O servidor filtra as velas onde $\text{time} < \text{before}$ e retorna as últimas `limit` barras desse subconjunto, permitindo navegação fluida em dias de histórico.

---

## 2. Passos de Execução Obrigatórios

### Passo 2.1: Especificação dos Contratos de Query e Sanitização Estrita
- **Ação:** Definir e validar rigorosamente os parâmetros aceitos:
  * `symbol`: Obrigatório, string alfanumérica + `_` (`/^[A-Z0-9_]{3,32}$/`), validado contra os ativos autorizados.
  * `limit`: Opcional, inteiro entre `1` e `1000` (default: `500`).
  * `before`: Opcional, timestamp numérico inteiro em segundos UTC (`time < before`).
  * `interval`: Opcional, formato `1s`, `5s`, `1m`, `5m` (default: `1m`).
- **Critério de Aceite:** Queries fora da especificação respondem imediatamente com HTTP `400 Bad Request`.

### Passo 2.2: Implementação do Filtro Temporal no Ring Buffer em Memória
- **Ação:** No handler de `/candles` em `scripts/dev-live-feed.mjs`:
  ```javascript
  let matched = state.candles;
  const beforeParam = parsedUrl.searchParams.get('before');
  if (beforeParam) {
    const beforeSec = parseInt(beforeParam, 10);
    if (!isNaN(beforeSec) && beforeSec > 0) {
      matched = matched.filter(c => c.time < beforeSec);
    }
  }
  const data = matched.slice(-limit);
  ```
- **Critério de Aceite:** Ao passar `before = data[0].time`, o próximo lote contém estritamente velas anteriores a esse ponto.

### Passo 2.3: Headers de Metadados de Paginação e Cache Control
- **Ação:** Adicionar headers explicativos na resposta HTTP:
  * `X-Total-Bars`: Quantidade de barras retornadas no lote.
  * `X-Has-More`: `true` se ainda existirem velas anteriores a `before`, senão `false`.
  * `Cache-Control: public, max-age=5`: Cache de 5 segundos para lotes históricos fechados (reduz carga em scrolling repetitivo).
- **Critério de Aceite:** Headers presentes e precisos em todas as respostas 200 OK.

### Passo 2.4: Proteção contra Exaustão de CPU em Filtros de Array
- **Ação:** Otimizar a busca retroativa no array `state.candles` usando busca binária (*binary search*) para encontrar o índice de corte em $O(\log N)$ em vez de $O(N)$ com `.filter()`.
- **Critério de Aceite:** Resolução do filtro retroativo em $<0.2\text{ms}$ mesmo sob buffer máximo de 2.880 velas.

### Passo 2.5: Resposta Padronizada quando o Início do Histórico é Atingido
- **Ação:** Se não houver barras anteriores a `before` (chegou ao gênese da série), retornar array vazio `[]` com status `200 OK` e `X-Has-More: false`.
- **Critério de Aceite:** O frontend reconhece o fim do histórico e cessa as requisições retroativas.

### Passo 2.6: Teste de Integração Automatizado
- **Ação:** Criar script de teste que itera 3 lotes consecutivos via `before` e valida que não há sobreposição nem inversão temporal.
- **Critério de Aceite:** Suíte executada com 100% de sucesso.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Scroll Rápido em Alta Frequência):**
  - Simular 200 requisições simultâneas variando `before` para o mesmo ativo. Tempo de resposta p99 deve ser $< 15\text{ms}$.
- **Segurança (Injeção de Parâmetros e Tipos Extremos):**
  - Testar `before=-1`, `before=NaN`, `before=Infinity`, `before="'; DROP TABLE;"`. Todas devem ser sanitizadas ou rejeitadas com HTTP 400.
  - Testar poluição de parâmetros (`before=123&before=456`). Rejeitar com HTTP 400.
- **Caos (Buraco no Meio do Buffer):**
  - Simular consulta com `before` caindo exatamente num gap de fim de semana de Forex. O endpoint deve retornar as velas imediatamente anteriores ao gap sem quebrar.

---

## 4. Critérios de Aceite da Subetapa 2
- [ ] Rota `/candles` suporta `before=<timestamp>` e retorna fatias retroativas contínuas.
- [ ] Parâmetro `limit` aceita valores até 1.000 com sanitização anti-DoS.
- [ ] Fim da série retorna array vazio sem erro 500.
- [ ] Headers `X-Total-Bars` e `X-Has-More` emitidos corretamente.
