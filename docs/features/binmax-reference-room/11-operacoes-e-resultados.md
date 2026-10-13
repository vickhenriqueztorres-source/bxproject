# Subetapa 11 — Operações e resultados

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 10 APPROVED.
- Responsáveis: Frontend, chart, financeiro e QA.
- Skills: 01, 02, 03, 05, 06, 11, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/11/`; relatório: `relatorios/11-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Operações e resultados: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: OrderFlagsOverlay/TimeLinesOverlay, apresentação de resultados e consumidor de contratos delimitados.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Renderizar flags apenas para contratos confirmados; pending request não finge operação OPEN.
2. Contador usa expires_at oficial e relógio calibrado; preço strike oficial.
3. WIN/LOSS/DRAW e payout/refund vêm do servidor; toast deduplicado por contrato+estado terminal.
4. Eventos antigos OPEN não fazem SETTLED regredir; replay não repete toast/crédito.
5. Implementar fechamento manual de aviso e anúncios acessíveis; cor acompanhada de texto.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] WIN/LOSS/DRAW, falta de tick >= expiração permanece pendente; confirmar tick oficial usado.
- [ ] Evento duplicado e SETTLED antes de OPEN; estado terminal monotônico; um toast por contrato.
- [ ] Troca de ativo e múltiplas ordens: overlay correto, lista conservada.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

10000 eventos via cache/paginação com recursos limitados; dedup não cresce sem retenção definida.

### Caos e recuperação

Restart de settlement/WS, evento perdido e recuperação por snapshot; sem resultado calculado no browser.

### Segurança

Contrato alheio não aparece; logout remove toast/dados do sujeito; erros escapados.

## Gate e regra de avanço

Settlement real reconciliado, overlays corretos, dedup e acessibilidade aprovados.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desligar apresentação; efeitos financeiros somente reversões oficiais se necessidade real.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "11"
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

