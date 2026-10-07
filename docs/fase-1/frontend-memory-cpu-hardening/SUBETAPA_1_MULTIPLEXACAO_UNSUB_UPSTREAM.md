# Subetapa 1 — Multiplexação WebSocket & Desinscrição Dinâmica Upstream (refCount)

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_1_MULTIPLEXACAO_UNSUB_UPSTREAM.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-11 (1 Conexão por Aba / Max 10 Assinaturas), V-05 (Isolamento de Ativos)

---

## 1. Objetivo Técnico

Garantir que o `TradingFeedManager` no frontend opere sobre uma **única conexão WebSocket** para toda a aba do navegador, multiplexando inscrições de até 6 ou 10 ativos.

Além de receber e despachar ticks para os componentes inscritos, o gerenciador deve implementar um sistema de **contagem de referências (`refCount: Map<string, number>`)**.
Quando o último componente que escuta um ativo for desmontado ou trocar de par (`refCount == 0`):
1. O listener local é removido do `EventEmitter`.
2. O gerenciador envia ativamente uma mensagem para o WebSocket Gateway:
   ```json
   { "type": "unsubscribe", "symbol": "BTCUSD_OTC" }
   ```
3. O Gateway para de transmitir ticks daquele ativo para esta conexão, poupando CPU, I/O e banda de rede.

---

## 2. Passos de Execução

1. **Passo 1.1:** Adicionar mapa `subscriberCounts: Map<string, number>` em `TradingFeedManager.ts`.
2. **Passo 1.2:** No método `subscribeSymbol(symbol, callback)`, incrementar a contagem de ouvintes do símbolo. Se for a primeira inscrição (`count === 1`), enviar `{ type: 'subscribe', symbols: [symbol] }` upstream.
3. **Passo 1.3:** Na função retornada de unsubscribe, decrementar o contador. Se o contador atingir 0 (`count === 0`), remover do mapa e enviar `{ type: 'unsubscribe', symbol }` upstream.
4. **Passo 1.4:** Atualizar o WebSocket Gateway (`services/websocket-gateway/src/index.ts`) e o mock de dev (`scripts/dev-live-feed.mjs`) para processar o tipo de mensagem `"unsubscribe"` e remover o socket do set de assinantes do símbolo.
5. **Passo 1.5:** Criar teste de verificação `tests/test-subetapa-1-fe-multiplex-unsub.mjs`.
6. **Passo 1.6:** Executar o teste e validar o descarte e cancelamento upstream sob troca de tela.

---

## 3. Critérios de Aceite

- [x] O frontend nunca abre mais de 1 conexão WebSocket ativa por aba.
- [x] Múltiplos componentes podem escutar o mesmo símbolo sem duplicar mensagens upstream.
- [x] Ao fechar o último gráfico de um ativo, o gateway recebe `{ type: "unsubscribe", symbol }` em < 5ms.
- [x] O Gateway confirma a remoção do socket e cessa imediatamente o fan-out daquele símbolo.
