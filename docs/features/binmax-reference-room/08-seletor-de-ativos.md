# Subetapa 08 — Seletor de ativos

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 07 APPROVED.
- Responsáveis: Frontend, chart, fidelidade e QA.
- Skills: 01, 03, 11, 13, 14, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/08/`; relatório: `relatorios/08-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Seletor de ativos: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: AssetCatalogModal e catálogo/adaptador delimitados; armazenamento de favoritos; testes gráficos/UI.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Montar busca, categorias e tabela como referência dedicada; não extrair dimensões CSS de miniatura como verdade.
2. Carregar catálogo autorizado; payout/24 h sem origem mostram indisponível, não 85% ou mudança inventados.
3. Separar clique em favorito do clique em seleção; persistir preferências isoladas por sujeito conforme política.
4. Ao selecionar ativo atualizar label/gráfico/ticket conjuntamente; abortar respostas obsoletas.
5. Implementar teclado, foco inicial/restaurado, Escape, lista vazia/loading/erro.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Busca normal/acentos/strings longas, filtros, favoritos e ativo removido/fechado.
- [ ] A → B → A rápido e resposta A atrasada; nenhuma vela/payout/ordem mistura símbolos.
- [ ] Overlay proporção/hierarquia no popup; navegação sem mouse.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 seleções e catálogo grande paginado; medir recursos e tempo real de resposta UI.

### Caos e recuperação

REST lento/erro, storage cheio e catálogo alterado durante popup; nenhum dado inventado.

### Segurança

Nome de ativo malicioso renderizado como texto; seleção nunca permite ativo não autorizado no servidor.

## Âncoras visuais

Aprovar primeiro a folha de baseline inferida definida na MATRIZ-ACEITACAO.md: acionador/popup, busca, categorias, quatro colunas e linha selecionada. Registrar caixas em pixels no viewport 1024 × 576; depois comparar cada âncora ≤ 8 px, máximo 10 px sem desvio aceito. A imagem reduzida não determina largura CSS nativa.

## Gate e regra de avanço

Todos os estados navegáveis, fontes rastreadas, swaps sem contaminação e screenshot aprovado.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desligar apresentação e inverter somente incremento seletor; favoritos compatíveis.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "08"
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

