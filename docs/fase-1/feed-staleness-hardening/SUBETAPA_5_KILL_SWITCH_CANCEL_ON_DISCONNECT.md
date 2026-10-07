# Subetapa 5: Kill Switch & Cancel-on-Disconnect (Padrão HFT / FIA)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`  
**Invariantes Protegidas:** I-01 (Preservação de saldo), I-03 (Idempotência), B-01 (Proteção de execução)

---

## 1. Escopo e Objetivos da Subetapa
Implementar o padrão obrigatório de bolsas de alta frequência (HFT) e da *Futures Industry Association* (FIA): **Cancel-on-Disconnect** e **Kill Switch de Risco**. Quando o feed de cotações de um ativo se torna suspeito (stale por mais de 5s, desconexão de rede ou gap crítico), qualquer tentativa de abertura pendente ou em fila de espera é imediatamente neutralizada antes da execução, e a plataforma bloqueia novas ordens para impedir que o usuário ou a corretora assumam posições sobre um mercado cego.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 5.1: Política de Cancel-on-Disconnect para Ordens em Trânsito
- **Ação:** Se a conexão WebSocket do usuário cair durante a emissão de uma ordem (antes da confirmação do receipt):
  * O backend aborta a transação se o socket fechou antes do commit.
  * O cliente cancela o intent local e notifica o usuário via toast: *"Conexão interrompida. Ordem cancelada com segurança."*
- **Critério de Aceite:** Nenhuma ordem fica órfã em trânsito sem confirmação ao usuário.

### Passo 5.2: Kill Switch Atômico por Ativo (`index_risk_killswitch`)
- **Ação:** No Redis e no PostgreSQL, se o atraso de um ativo ultrapassar 5.000ms:
  * Ativação automática da flag `risk:killswitch:{symbol}` com TTL de 10s.
  * Qualquer chamada ao `RiskManager.checkAndReserveRisk` para esse símbolo falha imediatamente com `KILLSWITCH_ACTIVE`.
- **Critério de Aceite:** O bloqueio ocorre a nível de microsegundos no Redis antes de qualquer query no banco.

### Passo 5.3: Cancelamento de Ordens Pendentes Não-Confirmadas
- **Ação:** Ordens que estejam com status temporário de validação ou reserva de saldo que dependam de cotação do ativo bloqueado são estornadas imediatamente (`reversal:{ref}` no Blnk Ledger).
- **Critério de Aceite:** Saldo do usuário é restaurado em 100% dos cancelamentos sem perda de centavos.

### Passo 5.4: Preservação de Posições Abertas (Holding Posture)
- **Ação:** Conforme padrão industrial (HFT Book), ordens que já foram abertas e estão ativas (`status = 'OPEN'`) **NÃO são liquidadas precipitadamente a preço podre**. O settlement aguarda o feed voltar a gerar ticks legítimos com timestamp $\ge expires\_at$.
- **Critério de Aceite:** Posições abertas são protegidas contra liquidações espúrias em momentos de baixa liquidez ou corte temporário.

### Passo 5.5: Trava de Segurança no OrderTicket (Client-side Kill Switch)
- **Ação:** No [`OrderTicket.tsx`](file:///D:/brokerproject/apps/web/src/trade/OrderTicket.tsx):
  * Se o status do feed for `STALE` ou a conexão estiver `DISCONNECTED`:
    * Os botões operacionais são completamente bloqueados.
    * Qualquer tentativa de envio via atalhos de teclado (ex: teclas 1/2) é suprimida.
- **Critério de Aceite:** Zero envio de requisições HTTP para a API quando o cliente já detectou a anomalia.

### Passo 5.6: Notificação e Auditoria de Disparo do Kill Switch
- **Ação:** Registro de log estruturado no backend em formato JSON:
  ```json
  { "event": "KILL_SWITCH_TRIGGERED", "symbol": "BTCUSD_OTC", "reason": "STALE_FEED", "tick_age_ms": 5240, "timestamp": "2026-10-06T19:00:00Z" }
  ```
- **Critério de Aceite:** Auditoria completa e rastreabilidade forense de cada acionamento do switch.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Disparo do Kill Switch sob Injeção de Atraso
* Simular atraso de 6.000ms em um ativo.
* Submeter ordem via API diretamente.
* Verificar bloqueio com `KILLSWITCH_ACTIVE` e tempo de resposta $< 5\text{ ms}$.

### 3.2 Teste de Estorno Integral de Saldo
* Validar que qualquer ordem abortada pelo kill switch reverte qualquer reserva no Ledger Blnk sem saldo retido.

### 3.3 Teste de Retomada Automática do Kill Switch (Auto-Recovery)
* Injetar novos ticks válidos com cadência de 1Hz.
* Confirmar que a chave do Redis expira e a operação volta ao normal em $< 10\text{ s}$ sem necessidade de restart de pods.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. 100% de neutralização de risco em ativos sob estresse ou congelamento.
2. Nenhuma perda de saldo demo ou descompasso contábil.
3. Homologado pelo `financial-correctness-reviewer`.
