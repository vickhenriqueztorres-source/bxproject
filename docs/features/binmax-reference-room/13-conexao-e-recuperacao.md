# Subetapa 13 — Conexão e recuperação

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 12 APPROVED.
- Responsáveis: Frontend/feed, backend do gateway, QA e segurança.
- Skills: 01, 03, 04, 05, 06, 07, 11, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/13/`; relatório: `relatorios/13-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Conexão e recuperação: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Feed manager/use-feed/StalenessOverlay e gateway somente em passos causais separados.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Definir CONNECTED/CONNECTING/STALE/DISCONNECTED/UNAUTHORIZED com transições observáveis.
2. Overlay escurece como referência e impede novas ordens quando preços inválidos.
3. Indicador e latência são medidos; não 16/88 ms baseados apenas em um booleano.
4. Catch-up lastSequence, snapshot+live, dedup e descarte de callbacks de socket antigo.
5. Preservar intenção em submit ambíguo; reautenticar sem emitir nova ordem automaticamente.
6. Soak/retorno background e duas abas com subjects/ativos diferentes.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Sockets reais; JWT expirado; sequência 10, 12, 11, 12; catch-up e bounds.
- [ ] Timeout após commit, abrir popup durante reconexão, unmount e StrictMode.
- [ ] Indicador e mensagens correspondem ao estado; recovery não falsifica continuidade de OHLC.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

300 WS oficiais, tick 1/s e soak 30 min com heap/listeners/sockets; limiar feed não inventado.

### Caos e recuperação

Matar gateway/tickleader em ambiente descartável; rede lenta/particionada; provar PID/injeção/recuperação.

### Segurança

Handshake autorizado, rate limits, payload excessivamente grande, token sem URL/logs e logout entre abas.

## Gate e regra de avanço

Sem gap lógico não explicado, sem ordem duplicada, recuperação real e recursos medidos.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Flag OFF só aparência; protocolo rollback compatível sem perder mensagens persistidas.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "13"
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

