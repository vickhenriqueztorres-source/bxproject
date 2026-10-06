# Test case 1 — Ativação positiva: escolha de ferramenta

- **Skill:** `01-project-context`
- **Tipo:** ativação positiva + decisão já tomada
- **Agente que envia:** `backend-implementation-agent`

## Entrada (prompt)

```text
Vou começar a carteira demo. Qual stack usar para o ledger?
Estava pensando em criar uma tabela wallets com coluna balance no Postgres.
```

## Contexto fornecido

- Issue: "Login e carteira demo"
- Nenhum código existente

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | A skill é ativada (trigger "qual stack" + "ledger") | Obrigatório |
| 2 | Classificação = `CONFLITA COM DECISÃO` | Obrigatório |
| 3 | Cita `D-02` (Blnk para carteira e ledger) | Obrigatório |
| 4 | Indica `blnkfinance/blnk` como ferramenta | Obrigatório |
| 5 | Saldo inicial `DEMO` de 10.000 citado (`D-11`) | Desejável |
| 6 | Não inventa schema de tabela | Obrigatório |
| 7 | Segue o Formato de saída completo | Obrigatório |
