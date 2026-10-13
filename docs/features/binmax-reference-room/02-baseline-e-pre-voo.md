# Subetapa 02 — Baseline e pré-voo

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 01 APPROVED.
- Responsáveis: Orquestrador, QA e guardião; especialistas de infraestrutura para correções próprias.
- Skills: 01, 04, 06, 07, 09, 17, 19; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/02/`; relatório: `relatorios/02-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Baseline e pré-voo: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Evidências e relatórios BMR; qualquer arquivo de runtime/teste/config exige passo corretivo separado com lista fechada.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Registrar versões reais de Node, pnpm, Docker, Compose, k6, SHA e árvore efetiva; guardar patch sem conteúdo de segredos.
2. Executar build, testes frontend/unit e lint; capturar exit code, arquivos efetivos, contagens e falhas anteriores.
3. Verificar healthz/readyz e discovery JSON do realm broker-demo; HTTP 200 contendo HTML não é OIDC válido.
4. Identificar ambiente descartável, portas, bancos/volumes próprios e ausência de credenciais de produção antes de levantar serviços.
5. Reproduzir cada incompatibilidade que bloqueia o smoke; fixar passos corretivos pequenos antes de editar.
6. Executar smoke autenticado com carteira Blnk, contrato oficial, reserva, settlement e reconciliação; revisores avaliam lacunas.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Baseline explícita: pnpm exec vitest run apps/web/src tests/unit; registrar que numTotalTestSuites não equivale a arquivos únicos.
- [ ] pnpm --filter @broker/web build; pnpm lint; inventário dos scripts de integração/caos e exclusões.
- [ ] Smoke: dois usuários de teste, login real, saldo indisponível, payload strict, timeout após commit e replay da mesma intenção.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Provar 2 e 20 solicitações concorrentes com mesma chave em integração real: um contrato e uma reserva. Não confundir Array.from síncrono com concorrência.

### Caos e recuperação

Indisponibilidade Blnk/Redis/REST e perda de resposta depois do commit; estado permanece explícito, efeito financeiro 1× e reconciliação zero.

### Segurança

JWT real, BOLA com dois sujeitos, mass assignment; separar simulador local de stack oficial. Nunca iniciar composição com senhas default como ambiente certificado.

## Gate e regra de avanço

Build, lint, discovery e smoke aplicáveis válidos; checkout e falhas de base rastreados; nenhuma representação financeira enganosa ou incompatibilidade crítica não resolvida. Falha bloqueia etapa 03.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Correção isolada por patch reverso do incremento. Sem stack:reset, down -v ou restauração integral do checkout.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "02"
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

