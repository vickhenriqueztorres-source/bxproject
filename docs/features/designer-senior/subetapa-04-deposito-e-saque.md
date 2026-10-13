# Subetapa 04 — Depósito e Saque (Gestão Financeira Sem Atrito)

> **Filosofia:** Saque e depósito com a clareza de um terminal financeiro. O trader maduro quer a certeza absoluta de que, quando apertar "Sacar", o PIX cai na conta dele sem desculpas, sem rollovers obscuros e sem burocracia desnecessária.

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `apps/web/src/pages/DepositPage.tsx` e `apps/web/src/wallet/BinmaxDepositModal.tsx`
- `apps/web/src/pages/WithdrawPage.tsx` e `apps/web/src/wallet/BinmaxWithdrawModal.tsx`
- `apps/web/src/wallet/wallet-precision-stress.unit.test.tsx` (Testes de estresse financeiro e UI)

### Arquivos Proibidos:
- Chamadas para o ledger Blnk ou serviços de carteira sem passar pelo adapter oficial.

---

## 2. Passo a Passo de Implementação

1. **Apresentação e Modais Escalares**:
   - Modais escalam de `0.98` para `1.0` com opacidade em 180ms (`--bm-t-base`).
   - Fundo com escurecimento de 60% e backdrop-filter neutro.
   - Sombra suave restrita ao contorno do modal flutuante.

2. **Tipografia Monetária de Alta Precisão**:
   - Saldos, valores disponíveis e taxas formatados estritamente em **Geist Mono** com `font-variant-numeric: tabular-nums`.
   - Rótulos explicativos em cinza/aço (`#8A92A1`) menores que os valores principais.

3. **Fluxo de Saque Transparente em 1 Clique**:
   - Seleção de método (PIX, Bancário, Cripto).
   - Indicação visual imediata do status de processamento via PIX.
   - Zero telas escondidas, zero avisos punitivos de bônus ou rollovers complexos.

4. **Confirmação Sóbria**:
   - Ao concluir depósito ou saque: transição suave com crossfade de 180ms.
   - Ícone de check circular limpo.
   - **Zero confetes, zero fogos de artifício, zero sons estridentes**.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários
- Renderização dos modais com valores monetários em formato tabular.
- Validação das regras de depósito e saque sem permitir valores negativos ou zero.
- Verificação de feedback de sucesso sóbrio sem elementos festivos.

### 3.2 Testes de Estresse
- Cliques rápidos múltiplos no botão de confirmação de saque: bloqueio imediato após o primeiro clique (prevenção de duplo saque I-04 / D-12).

### 3.3 Testes de Caos
- Simulação de rejeição da transação: exibição de mensagem de erro legível sem travamento de tela.

### 3.4 Testes de Segurança & Integridade Financeira
- Garantir que todos os valores de entrada sejam validados como inteiros menores (`minor_units`) ou número decimal rigorosamente validado.
- Proteção contra injeção de scripts no campo de chave PIX / carteira.

---

## 4. Critério de Aceite da Subetapa 04
- Suíte `wallet-precision-stress.unit.test.tsx` e `billetera.unit.test.tsx` 100% verdes no Vitest.
- Auditoria do `compliance-risk-reviewer` e do `designer-senior` aprovada.
