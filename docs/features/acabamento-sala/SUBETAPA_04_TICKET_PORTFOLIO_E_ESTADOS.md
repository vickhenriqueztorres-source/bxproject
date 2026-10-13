# SUBETAPA 04 — TICKET DE OPERAÇÕES, PORTFÓLIO RETRÁTIL E RESILIÊNCIA DE CONEXÃO
## Despoluição do Ticket, Gaveta Inferior Recolhida, Unificação do Portfólio e Latência Reativa

**Data:** 09/10/2026  
**Responsáveis:** `surgical-frontend-agent`, `compliance-risk-reviewer`, `qa-resilience-agent`  
**Escopo de Arquivos Autorizados:**
- `apps/web/src/trade/OrderTicket.tsx`
- `apps/web/src/components/drawer/PortfolioDrawer.tsx`
- `apps/web/src/components/footer/TerminalFooter.tsx`
- `apps/web/src/components/header/TerminalHeader.tsx`
- `apps/web/src/App.tsx`

---

## 1. Objetivos Técnicos e Mudanças Cirúrgicas

1. **Despoluição do Ticket de Ordens (Eliminação do Cartão Duplicado de Ganho):**
   - Remover do corpo do ticket o cartão flutuante `#guest_ +US$ 185,00` que competia diretamente com o toast oficial `TradeResultToast.tsx`.
   - Se houver necessidade de exibir a última operação no ticket, apresentar apenas uma linha sutil e despojada: `"Última operación: +$185.00"` em tipografia discreta cinza, sem cartão volumoso.
2. **Gaveta de Portfólio Inferior Recolhida por Padrão:**
   - Manter a gaveta de operações abertas e histórico recolhida por padrão (`isOpen = false`), mostrando apenas a barra discreta com botão interativo `"Mostrar posiciones ⌵"`.
   - Ao abrir a gaveta, limitar sua altura máxima estritamente em 220px-240px com scrollbar interna estilizada, evitando que ocupe 1/4 da tela vazia.
   - Formatar as posições abertas e históricas de forma limpa, com badges de status e ganho potencial devidamente padronizados no padrão visual institucional.
3. **Eliminação de Duplicidade em "Portafolio total":**
   - Remover a menção redundante de "Portafolio total" na barra do drawer inferior, mantendo o total consolidado unicamente na barra de status inferior (`TerminalFooter.tsx`), eliminando ruído visual.
4. **Comportamento Resiliente do Indicador de Latência:**
   - Em `TerminalHeader.tsx`, quando a conexão estiver ativa (`isLive = true`), exibir `"16ms"` com dot verde `#22C55E`.
   - Quando o feed estiver desconectado ou em estado `stale`, o dot deve assumir cor âmbar/cinza e o texto deve alternar para `"Reconectando…"`, oferecendo feedback transparente ao trader.

---

## 2. Passo a Passo de Execução

- **Passo 4.1:** Editar `OrderTicket.tsx` para remover o cartão duplicado de resultado de ordem, mantendo o anúncio/toast centralizado e um resumo sutil de última ordem caso aplicável.
- **Passo 4.2:** Ajustar `App.tsx` para garantir que `drawerOpen` inicie em `false`, e atualizar `PortfolioDrawer.tsx` com altura máxima de 220px e barra recolhida refinada.
- **Passo 4.3:** Ajustar `PortfolioDrawer.tsx` para remover texto duplicado de "Portafolio total", delegando para o `TerminalFooter.tsx`.
- **Passo 4.4:** Ajustar `TerminalHeader.tsx` para suporte dinâmico ao texto "Reconectando…" quando `!isLive`.

---

## 3. Protocolo de Testes e Validação

### Testes de Estresse e Caos
- **STRESS-05 (50 Rapid Orders):** Criar 50 ordens consecutivas em modo demo e verificar que a gaveta de operações com scroll interno suporta todas as linhas com rolagem fluida e tempo de expiração regressivo sincronizado.
- **CHAOS-03 (Connection Drop & Recovery):** Simular perda de conexão WebSocket: verificar se o badge do header muda instantaneamente de "16ms" verde para "Reconectando…" cinza/âmbar, e se retorna suavemente ao reconectar.

### Testes de Segurança Financeira
- **SEC-03 (Idempotency & Re-entry Protection):** Comprovar que o botão de fechar ou ocultar a gaveta e os botões SUBE/BAJA do ticket preservam bloqueio estrito contra duplo clique concorrente.

---

## 4. Critérios de Aceite para Fechamento da Subetapa

- [ ] Cartão duplicado `#guest_` removido do ticket; apenas toast elegante renderizado no canto inferior esquerdo.
- [ ] Gaveta inferior recolhida por padrão com acionador "Mostrar posiciones ⌵" e altura máxima de 220px quando aberta.
- [ ] Portfólio total exibido apenas no rodapé.
- [ ] Indicador de conexão exibe "Reconectando…" em stale/desconectado.
- [ ] Novo arquivo de teste unitário `apps/web/src/trade/subetapa-18-04-ticket-portfolio.unit.test.tsx` com 100% de aprovação.
