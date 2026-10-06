# Subfase 6: WebSocket Gateway & Frontend TradingView Realtime

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `frontend-realtime-agent`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T08, T13, T14  
**Decisões Aplicadas:** D-01 (Keycloak OIDC), D-03 (TradingView Lightweight Charts), D-04 (Redis Streams vs Pub/Sub), D-11 (Carteira Demo 10.000 USD), D-18 (Moeda USD formatada pt-BR)  
**Invariantes Chave:** F-01 a F-14, M-06, S-01, S-02, B-16  

---

## 1. Escopo e Objetivos da Subfase
Desenvolver o serviço `services/websocket-gateway` com autenticação JWT na primeira mensagem, fan-out eficiente de ticks via Redis Pub/Sub e suporte a catch-up por `lastSequence` via Redis Streams. No frontend (`apps/web`), construir a aplicação de trading com React + Vite + TypeScript integrando a biblioteca TradingView Lightweight Charts, exibição de histórico via REST, atualização de velas em tempo real a 250ms/tick, boleta UP/DOWN com geração de `Idempotency-Key` (UUIDv4) e trava visual de compra 30 segundos antes da expiração da vela. Por fim, implementar o painel administrativo básico em `apps/admin`.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 6.1: Implementação do WebSocket Gateway (`services/websocket-gateway`)
- **Ação:** Criar o gateway de WebSockets de alta performance com Fastify WS:
  - Autenticação obrigatória: o cliente deve enviar a mensagem `{ "type": "auth", "token": "<JWT>" }` em até 5 segundos após o handshake TCP. Se não enviar ou o token for inválido, o socket é fechado com código `4401`.
  - Proibição estrita: o token nunca é trafegado em query string de URL (`F-05`, `S-02`).
  - Governança de conexões:
    - Máximo de 5 conexões simultâneas por usuário (a 6ª é recusada com código `4429`).
    - Máximo de 10 subscrições de símbolos por conexão.
    - Mecanismo de Ping/Pong: ping a cada 15 segundos; fechamento com código `4408` após 45 segundos sem pong.
  - Subscrição em Redis Pub/Sub (`market:ticks:{symbol}`) para broadcast de ticks aos clientes conectados.
- **Regras:** `B-16`, `M-06`, `S-02`.
- **Critério de Aceite:** O gateway autentica usuários de forma segura, gerencia milhares de conexões e faz o broadcast com latência de rede interna < 2ms.

---

### Passo 6.2: Mecanismo de Catch-up por `lastSequence` em Reconexões
- **Ação:** Implementar o protocolo de sincronização em `services/websocket-gateway/src/handlers/catchup-handler.ts`:
  - O cliente envia: `{ "type": "subscribe", "symbol": "EURUSD_OTC", "lastSequence": 49200 }`.
  - Se `lastSequence` for informado:
    - O gateway consulta o Redis Stream `stream:ticks:{symbol}` buscando mensagens onde `sequence > lastSequence`.
    - Se o gap estiver dentro do buffer de retenção do Stream (ex: últimos 1.000 ticks):
      - Envia os ticks faltantes em lote ordenado para o cliente.
      - Ativa o encaminhamento de ticks ao vivo do Pub/Sub.
    - Se o gap for superior à retenção do Stream:
      - Envia mensagem `{ "type": "resync_required" }`, instruindo o frontend a recarregar o histórico via REST `/api/v1/chart/history`.
- **Regras:** `M-06`, `F-06`, `F-07`.
- **Critério de Aceite:** O frontend pode sofrer uma desconexão de 20 segundos e recuperar todos os ticks perdidos na ordem exata sem duplicar dados no gráfico.

---

### Passo 6.3: Integração do Gráfico com TradingView Lightweight Charts
- **Ação:** Criar o componente `apps/web/src/components/chart/TradingViewCanvas.tsx`:
  - Instanciação de `createChart` do TradingView Lightweight Charts com paleta escura profissional (background `#0B0E14`, velas verdes `#089981` e vermelhas `#F23645`).
  - Carga inicial de dados históricos consumindo `GET /api/v1/chart/history` via TanStack Query e populando o gráfico com `candleSeries.setData(historicalBars)`.
  - Tratamento de ticks ao vivo recebidos via WebSocket:
    - Descarte de ticks fora de ordem: descarta qualquer tick onde `sequence <= lastSequenceRef.current` (`F-06`).
    - Atualização em tempo real da vela em formação com `candleSeries.update(...)`.
  - Responsividade automática com `ResizeObserver` ajustando largura e altura do canvas.
- **Regras:** `D-03`, `F-08`, `F-13`.
- **Critério de Aceite:** O gráfico renderiza suavemente com zoom, rolagem e movimentação em tempo real do pavio da vela a cada 250ms sem travamentos.

---

### Passo 6.4: Boleta de Negociação (CALL / PUT) com Trava de Solvência
- **Ação:** Criar `apps/web/src/components/trading/TradeTicket.tsx`:
  - Seletor de direção: botões "UP" (Verde) e "DOWN" (Vermelho).
  - Campo de valor de aposta (`stake`):
    - Input validado em centavos inteiros (mínimo US$ 1,00, máximo US$ 100,00).
    - Exibição de payout de 85% calculado em tempo de execução: "Lucro Potencial: +US$ 8,50".
  - Trava de Expiração de 30 Segundos:
    - Contagem regressiva visual sincronizada com o relógio do servidor (`/api/v1/chart/time`).
    - Quando a vela atinge os últimos 30 segundos antes do fechamento, a boleta desabilita as compras com mensagem: *"Entradas travadas para esta vela. Próxima entrada disponível na abertura da próxima vela."*
  - Idempotência no Clique:
    - Ao clicar em "Comprar", gera um UUIDv4 (`crypto.randomUUID()`) como `Idempotency-Key`.
    - Desabilita imediatamente o botão e exibe spinner de carregamento até a resposta da API, impedindo clique duplo (`F-10`).
- **Regras:** `F-01`, `F-02`, `F-10`, `F-11`.
- **Critério de Aceite:** O usuário não consegue enviar duas ordens acidentalmente e as compras são bloqueadas nos últimos 30 segundos da vela.

---

### Passo 6.5: Carteira Demo e Histórico de Contratos no Frontend
- **Ação:** Criar `apps/web/src/components/wallet/DemoWallet.tsx` e `apps/web/src/components/trading/ContractHistory.tsx`:
  - Exibição do Saldo Demo no topo da página:
    - Formatação da moeda com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })` aplicada sobre o inteiro de centavos (`F-02`).
    - Atualização do saldo após abertura ou liquidação via invalidação de cache do TanStack Query ou mensagem push do WebSocket (`F-03`).
  - Histórico de Operações:
    - Tabela de contratos abertos e finalizados com badge de status (`OPEN`, `WIN`, `LOSS`, `DRAW`).
    - Linha horizontal desenhada no gráfico Lightweight Charts indicando o preço de entrada da ordem ativa e contador regressivo.
- **Regras:** `F-02`, `F-03`, `F-09`, `D-18`.
- **Critério de Aceite:** O saldo reflete com exatidão o retorno do backend e a tabela exibe os resultados oficiais assim que o contrato é liquidado.

---

### Passo 6.6: Painel Administrativo Básico (`apps/admin`)
- **Ação:** Construir a interface administrativa com Refine ou React Admin:
  - Autenticação OIDC restrita a usuários com role `ADMIN` ou `AUDITOR` no Keycloak (`F-14`).
  - Tela de Gestão de Ativos:
    - Botão "Pausar Ativo" e "Retomar Ativo" (`POST /admin/indices/EURUSD_OTC/pause`).
    - Exige confirmação modal com justificativa textual e grava em `audit_logs`.
  - Tela de Monitoramento de Contratos: visualização de ordens ativas em tempo real e contratos recentemente liquidados.
  - Tela de Alertas e Reconciliação: exibição do status das checagens do Reconciliador Financeiro.
  - **Proibição estrita:** Nenhuma tela administrativa possui botão ou funcionalidade de edição direta de saldo de usuário (`B-14`, `F-14`).
- **Regras:** `B-14`, `F-14`, `S-03`.
- **Critério de Aceite:** Administradores conseguem pausar o índice com auditoria e usuários com role `AUDITOR` visualizam telas sem permissão de escrita.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Trader conecta na aplicação web, visualiza o gráfico TradingView atualizando a 250ms e o saldo demo de US$ 10.000,00.
2. Trader abre uma ordem CALL de US$ 10,00, visualiza a linha de entrada no gráfico e recebe a notificação oficial de WIN/LOSS aos 60s.
3. Desconexão de rede é recuperada suavemente via catch-up por `lastSequence`.
4. Gate de qualidade da Subfase 6 marcado como `PASS`.
