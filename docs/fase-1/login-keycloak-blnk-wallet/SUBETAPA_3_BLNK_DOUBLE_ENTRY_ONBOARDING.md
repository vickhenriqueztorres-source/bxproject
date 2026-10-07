# Subetapa 3: Blnk Ledger Onboarding (Partidas Dobradas e Injeção Seed Demo)

**Agentes Responsáveis:** `financial-correctness-reviewer`, `backend-implementation-agent`  
**Skills:** `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes Auditadas:** I-01 (Append-only), I-02 (Double-entry), I-03 (Idempotência), D-18 (Minor units)

---

## 1. Objetivo Técnico
Garantir que a criação de saldo e gestão de contas do usuário no **Blnk Ledger** cumpra rigorosamente os princípios de contabilidade institucional de dupla entrada:
1. Nenhuma conta é criada ou saldo injetado sem partidas dobradas.
2. Cada centavo creditado na carteira do usuário provém da conta institucional de liquidez (`@broker_float`).
3. O crédito inicial de **US$ 10.000,00** (`1_000_000_minor`) deve ser **estritamente idempotente** utilizando a chave de referência única `onboarding:{sub}`.
4. Se o usuário fizer login 50 vezes, o saldo não pode se multiplicar nem duplicar.
5. Derivação do saldo exclusivamente a partir do histórico imutável de transações do Blnk.

---

## 2. Passo a Passo da Implementação

### 2.1 Topologia de Contas no Blnk Ledger
No ledger `broker_demo`:
- Contas Institucionais da Casa:
  - `@broker_float`: Fonte de liquidez e capital para saldos demonstrativos.
  - `@house_revenue`: Destino das perdas de clientes (Losses).
  - `@house_payout`: Origem dos ganhos pagos aos clientes (Wins).
- Contas do Usuário (por `user_id` / `sub`):
  - `@user_{sub}:available`: Saldo livre para negociar.
  - `@user_{sub}:reserved`: Saldo retido em contratos abertos em andamento.

### 2.2 Pipeline de Onboarding Idempotente (`services/wallet-adapter/src/blnk-client.ts`)
```typescript
async onboardUser(userId: string): Promise<void> {
  const availableAcc = `@user_${userId}:available`;
  const reservedAcc = `@user_${userId}:reserved`;

  // 1. Cria contas no Blnk se não existirem
  await this.ensureAccount({ number: availableAcc, name: `User ${userId} Available` });
  await this.ensureAccount({ number: reservedAcc, name: `User ${userId} Reserved` });

  // 2. Transação de Dupla Entrada com chave de referência idempotente: onboarding:{sub}
  try {
    await this.recordTransaction({
      amount: 1_000_000, // US$ 10.000,00 em centavos (I-01, D-18)
      precision: 100,
      currency: "USD",
      source: this.BROKER_FLOAT,
      destination: availableAcc,
      reference: `onboarding:${userId}`,
      description: "Initial Demo Seed Balance US$ 10,000",
      allow_overdraft: true
    });
  } catch (err: any) {
    // Idempotência: se a referência já foi executada, o Blnk retorna conflito esperado
    if (!err.message?.includes("409") && !err.message?.includes("conflict")) {
      throw err;
    }
  }
}
```

---

## 3. Matriz de Testes & Validação Financeira

### Teste I-02: Equação de Soma Zero no Onboarding
- **Débito:** `@broker_float` = $10.000,00
- **Crédito:** `@user_{sub}:available` = $10.000,00
- **Balanço Líquido do Ledger:** $\Delta = 0$ (Zero soma).

### Teste I-03: Estresse de Idempotência do Onboarding
- **Ação:** Disparar 20 requisições simultâneas de onboarding para o mesmo `sub`.
- **Critério de Sucesso:** Exatamente uma transação gravada no Blnk; saldo final estritamente igual a $10.000,00 (sem duplicação para $200.000,00).

---

## 4. Critério de Aceite da Subetapa 3
- [x] Contas da casa `@broker_float`, `@house_revenue`, `@house_payout` inicializadas.
- [x] Contas do usuário criadas com segregação de saldo disponível e reservado.
- [x] Transação seed de US$ 10.000 registrada com partidas dobradas e chave `onboarding:{sub}`.
- [x] Teste de concorrência comprovando idempotência com 100% de precisão.
