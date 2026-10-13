# SUBETAPA 04: TICKET DE ORDEM ERGONÔMICO & TOASTS DE RESULTADO (SESSÃO 1 & 4)

**Objetivo:** Implementar o painel lateral de execução de ordens (Ticket de 150px) com steppers ergonômicos e botões simétricos de alta conversão `SUBE` e `BAJA`, além do sistema de notificações flutuantes (Toasts) de resultado da operação (`Ganaste` / `Perdiste`), correspondendo às Sessões 1 e 4.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/trade/OrderTicket.tsx`
  * `apps/web/src/components/toasts/TradeResultToast.tsx` (ou componente equivalente)
  * `apps/web/src/trade/subetapa-05-order-ticket-fidelity.unit.test.tsx`
  * `apps/web/src/trade/ticket-ergonomic.unit.test.tsx`
- **Fronteira Proibida:** O frontend nunca calcula o settlement nem altera o saldo local sem confirmação do evento de liquidação.

---

## 2. Detalhamento do Ticket e dos Toasts

### 2.1 Dock do Ticket de Ordem (Sessão 1):
- **Largura:** 150-160px fixos, fundo escuro `#151922`.
- **Card Monto:**
  * Rótulo `Monto` com ícone de ajuda `(?)`.
  * Stepper com botões laterais `[-]` e `[+]` e valor centralizado `$ 100`.
- **Card Expiración:**
  * Rótulo `Expiración` com ícone `(?)`.
  * Stepper com botões `[-]` e `[+]`, ícone de relógio e contagem `00:21`.
- **Card Ganancia:**
  * Rótulo `Ganancia` com ícone `(?)`.
  * Destaque em Verde Ganancia: porcentagem `+85%` e valor absoluto calculado `+$85.00`.
- **Botões Operacionais:**
  * Botão **SUBE:** Cor verde `#22C47A`, ícone de gráfico subindo, texto em caixa alta.
  * Botão **BAJA:** Cor vermelha `#F2545B`, ícone de gráfico descendo, texto em caixa alta.
  * Rigorosamente com a mesma altura, largura e destaque visual (D2).

### 2.2 Toasts Flutuantes de Resultado (Sessão 4):
- **Toast de Vitória (Ganaste):**
  * Ícone: Círculo verde com checkmark `✓`.
  * Título: `Ganaste` em negrito branco.
  * Valor em destaque: `+$85.00` em Verde Ganancia.
  * Detalhe: `NZD/JPY - SUBE` em cinza claro.
  * Botão de fechar: `×`.
- **Toast de Derrota (Perdiste):**
  * Ícone: Círculo vermelho com `✗`.
  * Título: `Perdiste` em negrito branco.
  * Valor em destaque: `-$100.00` em Vermelho Risco.
  * Detalhe: `NZD/JPY - BAJA` em cinza claro.
  * Botão de fechar: `×`.

---

## 3. Passo a Passo de Execução

1. **Refinamento do `OrderTicket.tsx`:**
   Ajustar a hierarquia visual dos cards de Monto, Expiración e Ganancia para bater com a Prancha 1, garantindo steppers táteis de 1 clique.
2. **Criação / Otimização do Componente de Toasts:**
   Substituir avisos genéricos por notificações flutuantes personalizadas exatamente como no card "4. Aviso de resultado (ganhe/perca)".
3. **Prevenção de Duplo Clique (Debounce / In-Flight Guard):**
   Bloquear novos disparos enquanto a requisição da ordem atual estiver em processamento.
4. **Execução de Testes Unitários e de Idempotência:**
   Testar cabeçalho `Idempotency-Key` e parsing rigoroso de inteiros.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Validação dos steppers de Monto e Expiración.
- Cálculo correto de lucro esperado baseado em `floor(stake_minor * payout / 100)`.

### 4.2 Teste de Estresse (Cliques Frenéticos):
- Simular 50 cliques simultâneos no botão SUBE: garantir que apenas UMA requisição é enviada por vez (proteção anti-duplo disparo).

### 4.3 Teste de Caos:
- Disparo de ordens com conexão instável: o botão deve exibir estado de loading desabilitado e recuperar graciosamente.

### 4.4 Teste de Segurança:
- Provar que valores fracionários ou strings maliciosas no input de montante são higienizados e nunca causam NaN.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Ticket com steppers idêntico à imagem.
- Toasts de vitória e derrota exibidos com precisão visual e temporal.
