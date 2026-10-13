# Subetapa 19 — Entrega e ativação

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 18 APPROVED.
- Responsáveis: Orquestrador, operações, QA e revisores.
- Skills: 01, 07, 09, 10, 14, 19, 20; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/19/`; relatório: `relatorios/19-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Entrega e ativação: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Relatórios, estado, runbook e configuração de ativação específica; sem governança congelada.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Conferir aprovação de 18 e rastrear os 19 relatórios para mesmo SHA/diff.
2. Preparar changelog, screenshots, limites conhecidos, flag/rollback e instruções de preview.
3. Commit seletivo apenas incremento aprovado; não publicar patches estranhos ou .env.
4. Manter flag nova OFF por padrão; ativação operacional somente depois de critérios e ambiente demo identificado.
5. Abrir preview correto servindo a aplicação; handoff financeiro real pertence ao responsável autorizado.
6. Registrar conclusão honesta ou BLOCKED com dependências, nunca FINISHED para feature incompleta.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Smoke pós-ativação, links/assets/rotas, flag OFF para rollback e versão efetiva servida.
- [ ] Confirmar relatórios/capturas ligados ao build/checkout; links legíveis e credenciais ausentes.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Verificar que ativação não cria duplicação de recursos; amostra operacional conforme gate 18.

### Caos e recuperação

Ensaio reversão da flag/build sem alterar DB/ledger; recovery a partir de estado persistido.

### Segurança

Revisão de segredos e superfície exposta; binding local quando preview; nenhuma chave em docs/logs.

## Gate e regra de avanço

19 gates aprovados, runbook e evidências revisados; feature completa somente assim.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Flag OFF e build anterior identificado; banco/ledger não retornam por edição manual.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "19"
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

