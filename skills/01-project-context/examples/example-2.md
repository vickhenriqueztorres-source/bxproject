# Example 2 — Proposta de troca de ferramenta e decisão pendente

## Entrada

```text
Agente: frontend-realtime-agent
"Posso trocar o Redis Pub/Sub por Kafka para o feed do gráfico?
 E qual painel admin eu configuro, React Admin ou Refine?"
```

## Raciocínio esperado

1. Trigger: "posso trocar X por Y" + "qual ferramenta".
2. Primeira pergunta conflita com `D-04` (Redis Streams + Pub/Sub).
3. Segunda pergunta toca `D-16`, que está **Pendente** — apresentar opções sem escolher.

## Saída

```text
CLASSIFICAÇÃO: CONFLITA COM DECISÃO
COMPONENTE: WebSocket Gateway, Outbox Relay, Painel admin
FERRAMENTA: Redis (Streams + Pub/Sub); React Admin ou Refine
DECISÕES RELACIONADAS: D-04, D-16
RESPOSTA:
  1. Kafka: conflita com D-04. O feed usa Redis Streams como fonte confiável
     e Pub/Sub apenas para fan-out visual. Proposta devolvida ao
     tech-lead-orchestrator para aprovação humana.
  2. Painel admin: D-16 está pendente. Opções registradas:
     - marmelab/react-admin — CRUD, filtros e autenticação
     - refinedev/refine — framework de admin/internal tools
     Telas exigidas em qualquer opção: lista de usuários, lista de contratos,
     consulta de ledger, pausar índice, bloquear usuário, ver alertas.
PENDÊNCIAS: D-16 aguardando escolha humana
```
