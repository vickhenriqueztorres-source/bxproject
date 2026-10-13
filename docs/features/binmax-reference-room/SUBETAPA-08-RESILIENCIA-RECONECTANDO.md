# SUBETAPA 08: RESILIÊNCIA DE CONEXÃO & OVERLAY RECONECTANDO (SESSÃO 10)

**Objetivo:** Implementar o overlay de proteção e resiliência visual "Reconectando..." sobre o gráfico quando o WebSocket for desconectado ou o feed sofrer congelamento de cotações (`stale`), bloqueando a emissão de ordens no vácuo conforme a Sessão 10.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/chart/ReconnectingOverlay.tsx` (ou componente equivalente no Chart)
  * `apps/web/src/feed/use-feed.ts`
  * `apps/web/src/trade/feed-resilience.unit.test.ts`
- **Fronteira Proibida:** Não alterar o protocolo WebSocket Gateway no backend além do tratamento seguro de eventos de reconnect no frontend.

---

## 2. Detalhamento do Overlay Reconectando (Sessão 10)

### 2.1 Elementos Visuais e Comportamento:
- **Disparo:** Quando `!feed.connected` OU `feed.stale === true`.
- **Backdrop:** Camada escura semi-transparente sobreposta à área do gráfico com leve desfoque (`backdrop-filter: blur(4px)`).
- **Ícone Central:** Símbolo de radar/Wi-Fi com ondas concêntricas pulsantes em animação suave.
- **Texto:** `Reconectando...` em Archivo Bold, cor `#DCE1EA`.
- **Proteção Operacional no Ticket:**
  * Durante a reconexão, os botões `SUBE` e `BAJA` são automaticamente desabilitados com opacidade reduzida e aviso de mercado sem cotação.
- **Restauração Transparente:**
  * Assim que a conexão for reestabelecida, o overlay desaparece e os candles mais recentes são sincronizados sem necessidade de recarregar a página (F5).

---

## 3. Passo a Passo de Execução

1. **Criação do Componente `ReconnectingOverlay.tsx`:**
   Implementar a animação SVG do radar e o texto centralizado sobre o container do gráfico.
2. **Integração com o Estado de Conexão do Gráfico:**
   Posicionar condicionalmente dentro do container do `PriceChart.tsx` ou do `MultiChartGrid.tsx`.
3. **Bloqueio Reativo do Ticket de Ordens:**
   Vincular o estado de reconexão às propriedades `disabled` dos botões SUBE/BAJA.
4. **Execução de Testes Automatizados de Caos:**
   Simular queda de rede e reconexão automática.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar que o overlay é renderizado quando `connected === false`.
- Verificar que o overlay some quando a conexão é restabelecida.

### 4.2 Teste de Caos (Drop de WebSocket):
- Interromper abruptamente o socket: o overlay deve surgir em menos de 100ms e desabilitar os botões do ticket imediatamente.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Overlay idêntico à Sessão 10 funcional sob simulação de desconexão.
