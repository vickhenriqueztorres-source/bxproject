# Subetapa 18 — Certificação integrada

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 17 APPROVED.
- Responsáveis: QA, guardião, financeiro, segurança, fidelidade e verificador independente.
- Skills: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 14, 19; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/18/`; relatório: `relatorios/18-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Certificação integrada: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: tests/** e services/*/test/**; relatórios/evidências. Código de produto só em correção causal separada.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Congelar SHA+diff efetivo e ambiente; revalidar gates 01–17 sem ressalvas obrigatórias.
2. Executar matriz de 12 estados em flag ON e OFF; screenshots/overlay e interações reais.
3. Executar 26 oráculos sem alteração, suítes descobertas e segurança JWT/BOLA/RBAC/XSS/entre abas.
4. Carga da Fase 1: 300 WS, 50 contratos/min, tick 1/s, abertura p95 < 200 ms; registrar janelas/amostras reais.
5. Caos real C01–C12 e pós-condições V01–V13 em Postgres/Redis/Blnk; provar injection/recovery.
6. Revisores independentes assinam conclusão com lacunas, não copiar assinatura em script.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Unitários/componentes/tipos/lint/build, integração real financeira e E2E no browser.
- [ ] WIN/LOSS/DRAW, idempotência, reversão/reconciliação, catch-up/hash/OHLC e zero duplicação.
- [ ] Acessibilidade automatizada se ferramenta existente + manual, contratos maliciosos e logout.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Soak 30 min, 300 WS/50 min, 50000 ticks em harness, 1000 ciclos UI; métricas reais e budgets propostos separados de oráculos.

### Caos e recuperação

Processo/rede falhando de verdade; assertNotProduction; ledger conservado e DLQ esperada; reset e down -v proibidos.

### Segurança

Dois usuários e admin reais, tokens adversariais, mass assignment, CSP/XSS, segredos, authorization server.

## Gate e regra de avanço

Todos os critérios aplicáveis executados/revisados; zero gate obrigatório faltante. CI correspondente quando exigido; mocks não substituem infra.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Correções por gate e replay da suíte afetada; preservar rastro da falha inicial.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "18"
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

