# Subetapa 04 — Isolamento da nova sala

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 03 APPROVED.
- Responsáveis: Cirurgião frontend e guardião.
- Skills: 01, 15, 17, 19; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/04/`; relatório: `relatorios/04-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Isolamento da nova sala: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Candidatos: apps/web/src/lib/feature-flags.ts; App.tsx; novo componente de apresentação e testes. Lista final fechada antes do passo.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Criar flag independente BINMAX_REFERENCE_ROOM, desligada por padrão; não alterar default do NEW_TRADEROOM existente.
2. Uma porta seleciona sala anterior ou nova com mesmos hooks/funções/estado; não duplicar engines.
3. Adicionar namespace CSS exclusivo e tratamento de override/localStorage negado.
4. Preservar IDs, callbacks e contratos públicos; mapear a extração de hook em passo próprio se inevitável.
5. Comparar OFF com baseline antes de qualquer componente visual novo.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Default OFF; override válido; valores inválidos; storage indisponível; navegação/reload.
- [ ] OFF: DOM, handlers, conexão e screenshots equivalentes à base; ON: mesma fonte de carteira/feed.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 ciclos controlados ON/OFF com desmontagem: contagem de assinaturas/sockets sem crescimento linear.

### Caos e recuperação

Storage quota/JSON corrompido e callbacks após unmount não deixam sala parcialmente montada.

### Segurança

Flag controla aparência; não concede conta REAL, permissão, ativo ou payout.

## Gate e regra de avanço

OFF preservado, ON isolado, sem segundo engine e sem alteração financeira; guardião aprova diff.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desligar a nova flag e aplicar inverso do passo; caminho anterior fica utilizável.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "04"
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

