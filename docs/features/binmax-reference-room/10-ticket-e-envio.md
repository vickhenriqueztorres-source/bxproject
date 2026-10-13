# Subetapa 10 — Ticket e envio

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 09 APPROVED.
- Responsáveis: Frontend, financeiro, compliance, segurança e QA.
- Skills: 01, 02, 04, 05, 06, 13, 14, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/10/`; relatório: `relatorios/10-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Ticket e envio: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: OrderTicket e apresentação nova; client/cálculo em passo financeiro próprio; testes.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Cards Monto/Expiración/Ganancia e menos/mais horizontais; SUBE/BAJA simétricos.
2. Separar string digitada de stake_minor validado; inteiros/limites e cotação oficial.
3. Expiração exibida calibra hora do servidor; não transmitir preço/resultado/payout do cliente.
4. Capturar uma intenção por ação autorizada, manter chave ao retentar resultado desconhecido.
5. Desabilitar com saldo desconhecido, stale, submit pendente e permissão insuficiente.
6. Confirmação/refund/erro baseados em contrato oficial; distinguir rejeição e timeout ambíguo.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Stake de 101/199 e limites: lucro floor de 85%, valores oficiais comparados; nenhum Math.round financeiro.
- [ ] Duplo clique/touch/Enter; 2/20 replays e mesma chave com corpo diferente; reserva 1×.
- [ ] Clockskew ± 120 s, respostas antigas e sucesso após fechamento.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

50 contratos/min e abertura p95 < 200 ms em stack descartável segundo Fase 1; clique rápido não mede capacidade da API.

### Caos e recuperação

Perda da resposta após commit, Blnk caído e restart: recuperar mesmo contrato, não nova intenção.

### Segurança

JWT/BOLA/mass assignment; cliente não define user_id/payout/preços/status; logs sem segredo.

## Gate e regra de avanço

UI fiel, integração/idempotência/ledger e revisão financeira/segurança aprovadas.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Flag OFF para aparência; incremento financeiro só por patch revisado; nenhum crédito manual.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "10"
task_id: T13
agent: "<responsável autorizado para este passo>"
objective: "<incremento único e reproduzível>"
context:
  - "Arquivos autorizados: <lista fechada>"
  - "Baseline e relatório anterior: <evidência>"
skills: ["<nomes reais aplicáveis>"]
acceptance_criteria: ["<provas acima aplicáveis ao passo>"]
budget:
  max_steps: 3
  max_tokens: 12000
  timeout: "30m"
```

O orçamento é do passo, não autorização para interromper a etapa sem registrar falha ou dependência. Workers não estão sozinhos no checkout; devem acomodar e preservar edições de outros.

