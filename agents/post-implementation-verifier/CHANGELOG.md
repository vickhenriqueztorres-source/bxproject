# Changelog — post-implementation-verifier

## [1.0.0] — 2026-06-10

### Adicionado

- Agente verificador independente: último passo antes do merge de cada subetapa (`MA-1`–`MA-7`),
  subtask (`T01`–`T18`) e degrau de carga/caos (`E1`–`E4`).
- Regras invioláveis `PV-01` a `PV-12`: somente leitura, evidência executada, commit fixo, ambiente
  descartável, uma reexecução no máximo, pendente nunca vira regra, teste enfraquecido invalida o `PASS`.
- Contrato de entrada com `commit`, `base`, `environment`, `window` e `gate_commands`.
- Bloco `verification` no contrato 2.2 com fingerprint, diff de testes, execuções e garantias `V-xx`.
- `scripts/health-check.sh before|after`: fingerprint do repositório e do `HEAD`.
- Matriz de garantias por etapa, critérios de ambiente, comandos permitidos e roteamento de falhas em `references/api-guide.md`.
