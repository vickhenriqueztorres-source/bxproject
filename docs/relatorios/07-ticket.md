# Relatório da Etapa 07 — Ticket (Monto, Expiración, Ganancia, SUBE, BAJA)

**Data:** 08 de Outubro de 2026  
**Responsável:** `tech-lead-orchestrator` com `cirurgiao`, `fidelidade-iq`, `marca-binmax`, `compliance-risco`, `guardiao-regressao`  
**Status:** **APROVADO E 100% VERDE**

---

## 1. Resumo Executivo

A Etapa 07 reformulou a coluna operacional da direita (Ticket) no molde exato da IQ Option, mantendo estritamente a largura estreita (~120px) e os 5 blocos canônicos D1 a D5, sem acréscimo de elementos supérfluos, chips de valor, nem dicas secundárias. A implementação foi realizada sob a feature flag `isNewTraderoomEnabled()`, assegurando o princípio de "duas portas" (isolamento cirúrgico de layout e reutilização completa da máquina de estado e envio).

A integridade financeira e a assinatura de rede foram rigorosamente comprovadas: `git diff apps/web/src/api/client.ts` é 100% vazio.

---

## 2. Conformidade Visual e Estrutural (Zona D: D1 a D5)

| ID | Elemento | Molde IQ Option | Implementação Binmax | Status |
|:---|:---|:---|:---|:---|
| **D1** | **Monto** | Rótulo cinza "Invest ⓘ", input com valor `$ 1`, botões `+` e `−` empilhados verticalmente à direita | Rótulo "Monto ⓘ", input com `$`, dígitos em Geist Mono, botões `+` e `−` verticais com passo de $1 | **IGUAL** |
| **D2** | **Expiración** | Rótulo "Expiração ⓘ", ícone relógio + "02:06", botões `+` e `−` empilhados | Rótulo "Expiración ⓘ", ícone ⏱ + tempo alvo em Geist Mono, botões `+` e `−` navegando entre slots (Turbo 1m, Vela 1m, Vela 5m) + dropdown sob demanda | **IGUAL** |
| **D3** | **Ganancia** | Rótulo centralizado, "+85%" muito grande verde (~40px) com "%" menor, "+$0.85" verde negrito embaixo | Rótulo "Ganancia ⓘ", `+85%` em ~38px Geist Mono verde (#22C47A), `+$0.85` em negrito embaixo | **IGUAL** |
| **D4** | **SUBE** | Botão quase quadrado (~110x110px), ícone de subida no topo, texto ACIMA em negrito embaixo, cor de alta | Botão quase quadrado (~104x92px), ícone ▲, texto **SUBE**, fundo Verde Ganancia (`#22C47A`), texto Noche (`#0D0F14`) | **D2 (Verde Ganancia)** |
| **D5** | **BAJA** | Mesmo tamanho de D4, ~8px abaixo, ícone descida, texto ABAIXO | Mesmo formato (~104x92px), ~8px abaixo, ícone ▼, texto **BAJA**, fundo Rojo Baja (`#F2545B`), texto Noche (`#0D0F14`) | **D2 (Rojo Baja)** |

---

## 3. O que NÃO foi feito (Conformidade com Seção 5 de `docs/dashboard-ux.md`)

- [x] NÃO foram adicionados chips de valor rápido ($5, $10, $25, etc.) na visualização Binmax.
- [x] NÃO foi colocado texto "Recibes $X" ou "Compra cierra en".
- [x] NÃO foram alargadas as colunas (mantido estritamente em 120px).
- [x] NÃO foram criados atalhos de teclado novos (preservados exclusivamente os seguros `ArrowUp`/`u` e `ArrowDown`/`d`).

---

## 4. Proteção e Segurança de Operação

1. **Prevenção de Duplo Clique:**
   - O flag `busy` bloqueia imediatamente ambos os botões (`disabled={blocked || busy}`) no momento em que a promessa de envio `openContract` é despachada.
   - Teste unitário automatizado comprova que cliques concorrentes imediatos geram apenas 1 envio.
2. **Piso de Segurança de Expiração:**
   - O motor de cálculo de expiração (`calculateExecutionExpiry`) impõe piso incondicional de $\ge 30$ segundos, impedindo expirações instantâneas.
3. **Prova de Invariância de Rede:**
   - Assinatura inalterada de `openContract`:
     ```ts
     const opened = await openContract(
       symbol,
       current.direction,
       current.stakeMinor,
       current.key,
       durationSeconds,
       targetExpiresAt,
       mode
     );
     ```
   - Diff em `apps/web/src/api/client.ts`: Vazio (`0 files changed`).

---

## 5. Resultados dos Testes Automatizados

- **Suíte Vitest:** 15 arquivos de testes, 78 testes executados, **78 passando (100% verde)**.
- **Novos testes:** `apps/web/src/trade/ticket.unit.test.ts` (5 testes adicionados e aprovados).
