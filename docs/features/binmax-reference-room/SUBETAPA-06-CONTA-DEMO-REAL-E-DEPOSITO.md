# SUBETAPA 06: CONTA DEMO/REAL & MODAL DE DEPÓSITO TURBO (SESSÕES 8 & 9)

**Objetivo:** Implementar o dropdown de alternância entre Conta Real e Conta Prática (Sessão 8) e o Modal de Depósito de alta conversão com métodos PIX, Cartão e Cripto USDT (Sessão 9), alinhado com a paleta Turbo Prata.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/header/AccountSelectorDropdown.tsx`
  * `apps/web/src/wallet/TurboDepositModal.tsx` (ou refatoração cirúrgica de `BilleteraModal.tsx`)
  * `apps/web/src/trade/billetera.unit.test.tsx`
- **Fronteira Proibida:** Na Fase 1 MVP Demo, transações financeiras reais não chamam PSPs externos de produção; operam com simulação realista e carteira demo institucional com integridade de minor units (`available_minor`).

---

## 2. Detalhamento dos Componentes (Sessões 8 & 9)

### 2.1 Dropdown de Troca de Contas (Sessão 8):
- **Gatilho:** Ancorado no cabeçalho sobre o saldo e avatar do usuário.
- **Card de Opções:**
  * **Opção 1: Cuenta real:**
    - Rótulo `Cuenta real`.
    - Saldo `$9,603.75` em Verde Ganancia.
    - Checkmark indicador de conta ativa `✓`.
  * **Opção 2: Cuenta de práctica:**
    - Rótulo `Cuenta de práctica`.
    - Saldo `$10,000.00` em Verde Ganancia.
    - Botão de ação: `Recargar práctica` (recarrega para $10.000 com 1 clique).

### 2.2 Modal de Depósito (Sessão 9):
- **Visual e Dimensões:** Modal compacto e focado (~400px de largura) com backdrop translúcido escuro.
- **Cabeçalho:** Título `Depositar` e botão de fechar `×`.
- **Métodos de Pagamento:**
  * `PIX`: Ícone oficial PIX, texto `PIX`, subtítulo `Mínimo $10`, chevron de navegação `>`.
  * `Tarjeta`: Ícone de cartão de crédito, texto `Tarjeta`, subtítulo `Mínimo $10`, chevron `>`.
  * `Cripto (USDT)`: Ícone USDT (Tether), texto `Cripto (USDT)`, subtítulo `Mínimo $10`, chevron `>`.
- **Seletor de Quantias:**
  * Rótulo: `Monto`.
  * Botões pílula de seleção rápida: `[$20]`, `[$50]`, `[$100]`, `[$200]`.
- **Botão de Ação:**
  * Botão grande `Continuar` em Verde Ganancia `#22C47A` com texto em alto contraste.
- **Rodapé de Segurança:**
  * Ícone de cadeado e texto: `🔒 Tus pagos son procesados de forma segura`.

---

## 3. Passo a Passo de Execução

1. **Ajuste do `AccountSelectorDropdown.tsx`:**
   Garantir a presença das opções `Cuenta real` e `Cuenta de práctica` com o botão `Recargar práctica`, salvando a preferência do usuário.
2. **Desenvolvimento do `TurboDepositModal.tsx`:**
   Criar a tela de depósito de 1ª etapa exatamente como a Prancha 9, permitindo escolher o método e a quantia pré-selecionada.
3. **Integração com o Botão `Depositar` do Header:**
   O clique no botão verde do Header abre o modal de depósito focado imediatamente.
4. **Execução de Testes Automatizados:**
   Validar troca de contexto de conta e envio da intenção de depósito.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar seleção de quantias ($20, $50, $100, $200) e cálculo do valor final.
- Testar a recarga da conta prática (`resetMockWallet`) e atualização reativa do saldo.

### 4.2 Teste de Caos (Restauração e Concorrência):
- Acionar múltiplas recargas consecutivas: o saldo deve se manter em exatamente $10,000.00 sem duplicações indevidas.

### 4.3 Teste de Segurança:
- Provar que a alternância entre Real e Prática não contamina saldos e bloqueia transações indevidas.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Dropdown de conta idêntico à Sessão 8.
- Modal de depósito com os 3 métodos e quantias idêntico à Sessão 9.
