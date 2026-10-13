# Subetapa 03 — Contratos e verdade dos dados

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 02 APPROVED.
- Responsáveis: Frontend, backend, financeiro, segurança e QA.
- Skills: 01, 02, 04, 05, 08, 09, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/03/`; relatório: `relatorios/03-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Contratos e verdade dos dados: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Candidatos a confirmar por passo: apps/web/src/api/client.ts; services/api/src/routes/{contracts,wallet,chart}.ts; packages/shared/src/types.ts (schema não deve ser afrouxado); testes correspondentes.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Produzir matriz URL/método/schema/envelope/erros/autorização/fonte para cada estado.
2. Corrigir divergências reproduzidas entre frontend autenticado e API oficial, preservando assinatura pública.
3. Remover fallback financeiro falso no caminho operacional; loading/erro/vazio são estados distintos.
4. Usar payout, carteira, status e expiração oficiais; preservar floor(stake_minor * 85 / 100) aceito pelo autor, sem mudar governança congelada.
5. Definir recuperação de intenção ambígua e resposta antiga; separar fixtures explícitas da operação.
6. Confirmar ausência de API real/PSP/torneio como dependência externa; não criar contrato financeiro novo por inferência do raster.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Parser inteiro: limites, frações inválidas, NaN/Infinity e overflow; contratos desconhecidos falham.
- [ ] Integração do client real com handlers reais e infraestrutura descartável; URLs/envelopes sem fixtures disfarçadas.
- [ ] Mesma chave/corpo distinto rejeitada conforme contrato definido; ausência de header rejeitada.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

20 replays concorrentes e respostas fora de ordem; status terminal monotônico; soma zero no ledger.

### Caos e recuperação

Falha Blnk e timeout não retornam saldo inventado; restart preserva intenção e contratos.

### Segurança

iss/aud/alg/exp/sub/RBAC e BOLA; campos payout/user_id/preço/resultado/expiração enviados pelo cliente nunca são autoridades.

## Gate e regra de avanço

Matriz completa, smoke do caminho autenticado e financeiro aprovados por revisores; nenhuma fonte fixa operacional.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Reverter somente correções aprovadas; migração se necessária exige seu próprio plano de compatibilidade/rollback.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "03"
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

