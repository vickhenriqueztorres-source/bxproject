# Test case 2 — Pedido fora do escopo

- **Skill:** `01-project-context`
- **Tipo:** classificação de escopo
- **Agente que envia:** `tech-lead-orchestrator`

## Entrada (prompt)

```text
Issue #12: adicionar um segundo índice sintético (Volatility 75) e contratos
do tipo touch/no-touch. Isso entra na Fase 1?
```

## Contexto fornecido

- Escopo da Fase 1 carregado
- Nenhuma decisão de fase futura registrada

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | A skill é ativada (trigger "entra na Fase 1") | Obrigatório |
| 2 | Classificação = `FORA DO ESCOPO DA FASE 1` | Obrigatório |
| 3 | Aponta "Um índice sintético" como item de escopo mais próximo | Obrigatório |
| 4 | Aponta "Contrato subir/descer com expiração fixa" como item mais próximo | Obrigatório |
| 5 | Não cria plano de implementação | Obrigatório |
| 6 | Segue o Formato de saída completo | Obrigatório |
