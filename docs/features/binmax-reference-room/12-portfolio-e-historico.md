# Subetapa 12 — Portfólio e histórico

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 11 APPROVED.
- Responsáveis: Frontend, fidelidade, financeiro e QA.
- Skills: 01, 02, 04, 06, 13, 14, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/12/`; relatório: `relatorios/12-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Portfólio e histórico: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: SidebarDock, PortfolioDrawer, History e novo shell de gaveta em passos separados.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Passar coleção oficial ao sidebar; eliminar vazio fixo quando contratos existem.
2. Gaveta compartilhada à esquerda do gráfico; abas abertas/fechadas e vazio verdadeiro.
3. Histórico filtra estado/data com timezone declarado e paginação suportada pela API.
4. Ganhos/totais derivam dos valores oficiais inteiros, sem recalcular 85% local.
5. Loading/erro/vazio distintos; nenhum seed financeiro/extrato inventado operacional.
6. Atualizar via eventos e snapshot com dedup; não contaminar após logout/ativo/conta.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Abrir/fechar, filtros, teclado, foco e lista vazia/erro; mesma entidade nas duas gavetas.
- [ ] Dias/timezone/DST, paginação, resultado DRAW e totais oficiais.
- [ ] BOLA dois sujeitos, resposta atrasada de filtro e SETTLED após reconexão.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

10000 registros via paginação/virtualização existente e 1000 ciclos; memória limitada.

### Caos e recuperação

Timeout REST e duplicação/perda WS; erro não vira lista vazia definitiva; catch-up recupera posição.

### Segurança

Queries escopadas; labels escapados; nenhum contrato de outro usuário ou valor seed.

## Âncoras visuais

Antes do código, revisar largura inferida da gaveta, vínculo ao rail, título/fechar, abas/filtro e área de conteúdo/vazio conforme MATRIZ-ACEITACAO.md. Registrar pixels no viewport; comparar cada âncora ≤ 8 px, máximo 10 px sem desvio aceito. Miniaturas não são dimensões CSS nativas.

## Gate e regra de avanço

Dados oficiais e todos os estados das gavetas visualmente aprovados; sem totais falsos.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Inverter incremento de apresentação/cache compatível; não apagar contratos.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "12"
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

