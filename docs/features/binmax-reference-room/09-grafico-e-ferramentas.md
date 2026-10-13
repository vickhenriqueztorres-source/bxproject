# Subetapa 09 — Gráfico e ferramentas

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 08 APPROVED.
- Responsáveis: Chart engineer, cirurgião, QA e fidelidade.
- Skills: 01, 03, 06, 11, 14, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/09/`; relatório: `relatorios/09-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Gráfico e ferramentas: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: apps/web/src/chart/** e testes gráficos; feed somente em passo causal separado.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Preservar correções de boot/gap/hidratação; não remover ou reescrever testes existentes.
2. Posicionar ferramentas inferiores, informação do ativo, mood e etiquetas como referência.
3. Ancorar compra/expiração/strike por price/time/logical e dimensões atuais do chart.
4. Implementar seleção/hitboxes/drawings e indicadores existentes sem segundo gerador de preço.
5. Mood exige fonte real ou indicação ausente; não inventar porcentagem.
6. Executar replay, resize, pan/zoom, mudança de timeframe/ativo e context restore.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] OHLC recalculável; bucket de tempo; merge snapshot/live e ticks 10, 12, 11, 12.
- [ ] Casos boot sem histórico, cauda atrasada e gaps reais; nenhuma vela sintética preenchendo falta.
- [ ] Overlays coincidindo com preço/tempo; desenho isolado por ativo; séries removidas.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

50000 ticks em harness + navegador separado; medir p95 dos frames/tarefas longas para meta 60 fps, buffers limitados.

### Caos e recuperação

Fechamento WS, replay, perda de contexto, container zero e retorno do background 5 min; candle não reancorado.

### Segurança

Sanitizar desenhos, URLs, JSON e strings; não persistir token junto a desenhos.

## Gate e regra de avanço

18 regressões de boot preservadas, replay/invariantes e visual aprovados; performance medida sem atribuir FPS a SSR.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Inverter incremento gráfico após snapshot; não restaurar tick/DB/histórico.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "09"
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

