# Subetapa 06 — Shell desktop

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 05 APPROVED.
- Responsáveis: Cirurgião, fidelidade e guardião.
- Skills: 11, 14, 15, 17, 19; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/06/`; relatório: `relatorios/06-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Shell desktop: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Componente de layout da sala nova e seu CSS; módulos de dinheiro/feed não entram.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Montar header ~60 px, rail ~73 px, gráfico dominante, ticket ~150 px e footer único ~42 px na referência de 1024 × 576.
2. Usar grid/flex responsivos; preservar região do gráfico no resize sem recriar chart.
3. Posicionar rail na ordem da referência, painéis e bordas; remover duplicação visual do footer só no caminho novo.
4. Acomodar aviso de risco e registrar desvio autorizado pelo requisito de integridade.
5. Medir caixas no navegador em 1024 × 576 e demais desktops; overlay mascarando apenas valores variáveis.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Bordas do shell ≤ 4 px, controles ≤ 8 px, máximo 10 px sem desvio registrado.
- [ ] 1366 × 768/1440 × 900/1920 × 1080/2560 × 1440: sem clipping, scroll acidental ou alvos sobrepostos.
- [ ] Teclado e fullscreen mantêm foco; OFF comparado.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 ciclos de resize/montagem em harness e perfil navegador separado: listeners/ResizeObserver liberados.

### Caos e recuperação

Container temporariamente 0 × 0 e retorno não criam canvas enorme ou exceção.

### Segurança

Gavetas nunca encobrem aviso de risco ou alteram autorização/handlers de ordem.

## Gate e regra de avanço

Screenshot/overlay e medições aprovados, integração gráfica intacta, regressão OFF.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desligar flag ou inverter somente layout/CSS novo.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "06"
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

