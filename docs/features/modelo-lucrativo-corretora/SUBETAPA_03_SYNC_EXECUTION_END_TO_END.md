# SUBETAPA 03 — Sincronização End-to-End: Boleta, Gráfico e API de Execução

---

## 1. Objetivo Técnico
Garantir que a boleta (`OrderTicket.tsx`) calcule e repasse a duração correta (`duration_seconds`) do slot selecionado para a função `openContract` em `apps/web/src/api/client.ts`.
A chamada HTTP enviará `duration_seconds` no corpo da requisição `POST /v1/contracts`, permitindo que o servidor liquide o contrato no tempo exato acordado, sincronizado com os marcadores de compra e expiração desenhados no gráfico (`TimeLinesOverlay.tsx`).

---

## 2. Especificação de Mudanças

### 2.1. Cliente de API Frontend (`apps/web/src/api/client.ts`)
- No método `openContract`:
  ```typescript
  export const openContract = async (
    symbol: string,
    direction: 'UP' | 'DOWN',
    stakeMinor: number,
    idempotencyKey?: string,
    durationSeconds: number = 60,
    targetExpiresAt?: string,
    expiryMode?: ExpiryMode
  ): Promise<Receipt> => {
    // ...
    const envelope = await api<{ contract?: unknown }>('/v1/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({
        symbol,
        direction,
        stake_minor: stakeMinor,
        duration_seconds: durationSeconds,
      }),
    });
  ```

### 2.2. Sincronização com o Gráfico (`TimeLinesOverlay.tsx`)
- As linhas de expiração no gráfico refletem o tempo até o fim da vela ou da contagem turbo selecionada.

---

## 3. Matriz de Testes da Subetapa 03
1. **Teste de Integração de Execução**:
   - Disparo de ordem via `openContract` com `duration_seconds = 45` (fim da vela quando faltam 45s).
   - Servidor registra `expires_at` exatamente em `opened_at + 45s`.
   - Contrato liquidado com sucesso pelo `settlement-worker`.
