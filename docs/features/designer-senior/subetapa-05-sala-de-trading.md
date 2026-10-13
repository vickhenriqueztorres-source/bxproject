# Subetapa 05 — Sala de Trading (Instrumentação Cirúrgica & Latência Honesta)

> **Filosofia:** Movimento na BINMAX é instrumentação, não espetáculo. A ordem não disfarça a rede; o clique afunda em 0ms; nenhum spinner roda; o saldo conta em 500ms; o áudio é mudo por padrão (somente cliques mecânicos de 50ms se opt-in).

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `apps/web/src/App.tsx` (Configuração de som mudo por padrão, gavetas síncronas)
- `apps/web/src/trade/OrderTicket.tsx` (Feedback físico 0ms, zero spinners de espera)
- `apps/web/src/components/toasts/TradeResultToast.tsx` (Tempo de exibição de 4s, entrada 260ms e saída 180ms)
- `apps/web/src/chart/useTickPulse.ts` (Pulsação permitida apenas nos últimos 5s e no tick contínuo)
- `apps/web/src/trade/traderoom-precision-stress.unit.test.tsx` (Bateria de testes da sala de trading)

### Arquivos Proibidos:
- Motores de geração estocástica de tick, settlement do Postgres ou WebSockets de produção.

---

## 2. Passo a Passo de Implementação

1. **Configuração de Som e Feedback Sonoro**:
   - `soundEnabled = false` (Mudo por padrão).
   - Se o usuário ativar nos ajustes, os efeitos sonoros são cliques mecânicos de 50ms (tipo relé/contator seco), **NUNCA sons de moedas caindo ou trombetas**.

2. **O Clique SUBE/BAJA com Latência Honesta**:
   - `0ms`: O botão SUBE ou BAJA afunda 1px e escurece 6% no clique.
   - `Espera`: **ZERO SPINNERS**. Nenhum elemento roda. Se o backend demorar 20ms, o trader vê 20ms. Se demorar 400ms, vê os 400ms. A honestidade de latência comprova a ausência de manipulação da casa.
   - `Confirmação`: A linha horizontal de strike surge no gráfico com fade in de 100ms na coordenada exata de preço e tempo confirmados pelo backend.
   - `Saldo`: Conta numericamente de valor anterior para novo em 500ms.

3. **Liquidação e Expiração Sem Festa**:
   - Últimos 5 segundos: O cronômetro pulsa suavemente (opacidade 1.0 → 0.6 → 1.0 em 1s).
   - Zero: Um ponto fixo de 8px marca o fim sem explosões de partículas.
   - Toast de Resultado (`TradeResultToast.tsx`):
     - Duração: 4 segundos (`autoCloseMs = 4000`).
     - Entrada em 260ms com `--bm-ease` subindo 16px no canto inferior esquerdo.
     - Saída em 180ms com fade out.
     - Se WIN: saldo conta em verde durante 500ms e volta a branco.
     - Se LOSS: saldo apenas diminui em branco (sem drama de perda).

4. **Gavetas e Compressão de Gráfico**:
   - Gavetas (Portafolio, Historial, Torneos) deslizam da esquerda em 260ms enquanto o contêiner do gráfico se comprime sincronicamente. O gráfico nunca fica oculto por baixo da gaveta.

5. **Conexão Degradada**:
   - Queda de rede: em 180ms o gráfico perde saturação (filtro CSS `saturate(0.4)`), botões ficam em cinza, surge pílula discreta *"Reconectando..."* com ponto piscando 1x por segundo.
   - Restabelecimento: interpolação em 500ms do último preço ao novo, restauração de saturação em 180ms.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários
- Validação de que `soundEnabled` inicializa como `false`.
- Validação de que `TradeResultToast` fecha em 4s e não contém sons automáticos.
- Validação de que botões SUBE/BAJA não renderizam spinners de carregamento durante a execução de ordem.

### 3.2 Testes de Estresse & 60 FPS
- Simulação de 100 ticks por segundo para verificar que o rAF e as transições mantêm 60 FPS sem congelamento de render.

### 3.3 Testes de Caos
- Caos de desconexão instantânea de WebSocket e validação da dessaturação e pílula de reconexão.
- Disparo simultâneo de expirações e toasts sem vazamento de timers de `setTimeout`.

### 3.4 Testes de Segurança
- Garantia de que a coordenada de preço da ordem venha estritamente do backend, sem permitir que o cliente invente ou ajuste a linha de strike.

---

## 4. Critério de Aceite da Subetapa 05
- Suíte `traderoom-precision-stress.unit.test.tsx` e `trade-result-toast.unit.test.tsx` 100% verdes no Vitest.
- Auditoria do `designer-senior` e `compliance-risk-reviewer` aprovada.
