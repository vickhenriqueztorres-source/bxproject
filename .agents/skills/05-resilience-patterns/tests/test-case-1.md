# Test case 1 — Revisão do Wallet Adapter chamando o Blnk

- **Skill:** `05-resilience-patterns`
- **Tipo:** modo revisão
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
Ontem o Blnk ficou 3 minutos fora e os pods do wallet adapter ficaram travados. Revisar a chamada.
```

## Contexto fornecido — `services/wallet-adapter/reserve.ts`

```ts
export async function reserve(contract: Contract) {
  while (true) {
    try {
      const res = await fetch(`${process.env.BLNK_URL}/transactions`, {
        method: 'POST',
        body: JSON.stringify({ amount: contract.stake, reference: `reserve:${contract.id}`, source: contract.availableBalanceId, destination: contract.reservedBalanceId }),
      })
      if (!res.ok) throw new Error(`blnk ${res.status}`)
      return await res.json()
    } catch (error) {
      await sleep(1000)
    }
  }
}
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "fora do ar", "travados", chamada externa) | Obrigatório |
| 2 | R-03 FAIL — `fetch` sem timeout (linha 4) | Obrigatório |
| 3 | R-02 FAIL — retry infinito (linha 2), atraso fixo sem jitter (linha 11), repete 4xx (linha 8) | Obrigatório |
| 4 | R-04 FAIL — sem circuit breaker | Obrigatório |
| 5 | R-05 FAIL — nunca desiste, sem DLQ; erro engolido sem log/métrica (linha 10) | Obrigatório |
| 6 | Reconhece como ponto positivo a `reference` fixa (retry seguro do ponto de vista financeiro) | Obrigatório |
| 7 | Explica a causa do travamento: sem timeout + loop infinito por mensagem | Obrigatório |
| 8 | R-01 e R-06 marcados `N/A` | Obrigatório |
| 9 | Não escreve código corrigido | Obrigatório |
| 10 | `VEREDITO: REPROVADO` | Obrigatório |
