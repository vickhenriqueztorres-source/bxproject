# Expected output 1

## Deve conter

- `CLASSIFICAÇÃO: CONFLITA COM DECISÃO`
- `D-02`
- `blnkfinance/blnk`
- Indicação de que saldo não é coluna mutável (ver `02-financial-invariants`)

## Não deve conter

- Schema de tabela `wallets` com coluna `balance`
- Sugestão de outra biblioteca de ledger
- Aprovação da proposta original sem devolver ao orquestrador

## Saída de referência

```text
CLASSIFICAÇÃO: CONFLITA COM DECISÃO
COMPONENTE: Wallet Adapter
FERRAMENTA: Blnk (blnkfinance/blnk)
DECISÕES RELACIONADAS: D-02, D-11
RESPOSTA: A carteira demo e o ledger usam o Blnk (D-02). Uma tabela wallets com
          coluna balance conflita com essa decisão e com o ledger append-only.
          Criar a carteira DEMO no Blnk com saldo inicial de 10.000 (D-11) e
          registrar cada movimento como transação. Para regras de saldo, consultar
          a skill 02-financial-invariants.
          Proposta devolvida ao tech-lead-orchestrator para aprovação humana.
PENDÊNCIAS: nenhuma
```
