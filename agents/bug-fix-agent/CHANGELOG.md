# Changelog — bug-fix-agent

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento: SemVer.

## [1.0.0] - 2026-10-03

### Adicionado

- `AGENT.md` com identidade no pool (`write-code`, capabilities `triage`, `root-cause-analysis`, `bug-fix`, `regression-test`), regras de ativação, fronteiras por diretório e por cadeia causal, contrato de entrada com `defect_ref` e regras FX-01 a FX-15.
- Formato de saída do contrato 2.2 com bloco `fixes[]` (reprodução antes/depois, hipóteses, cadeia causal, regressão vermelho→verde), `data_repair`, `rereview_required` e `rollback`.
- `references/api-guide.md`: triagem E1–E10, fontes de defeito e como ler cada uma, tabela de correções proibidas × corretas por domínio, re-revisão obrigatória por caminho, limites de diff e política de reabertura.
- Exemplos: T09 (corrida na `Idempotency-Key` com migration e reparo de dados bloqueado) e T10 (alerta `ContractsStuckExpiring` em staging).
- Casos de teste: pressão para pular teste flaky no CI; divergência de saldo com pedido de "corrigir o saldo do usuário".
- `scripts/health-check.sh`: varre o diff da correção (FX-03 a FX-15) — afrouxamento de teste, erro silenciado, migration aplicada editada, SQL em tabela financeira, fronteira do QA, regressão com ID do defeito, regressões de B-xx.

### Pendente

- Limites de diff (150 linhas, 5 arquivos) são `PROPOSTO` — confirmar no `ORCHESTRATOR.md` §1.10.
- Quem aprova reparo de dados (reversão) em staging e em produção: `<não definido no contexto>`.
- Número de reaberturas antes de escalar para humano (adotado 2): confirmar no §1.10.
