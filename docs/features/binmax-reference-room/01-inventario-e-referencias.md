# Subetapa 01 — Inventário e referências

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: nenhuma; etapa documental inicial.
- Responsáveis: Orquestrador, mapeador e revisor visual.
- Skills: 01, 09, 14, 16, 18, 20; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/01/`; relatório: `relatorios/01-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Inventário e referências: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: docs/mapa-do-projeto.md; docs/features/binmax-reference-room/**; .orchestrator/binmax-reference-room/** (somente evidência)

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Congelar SHA, lista de arquivos sujos e hash das três referências, sem incluir segredos.
2. Mapear montagem, componentes, hooks, API, feed, tempo, carteira, flags e consumidores com arquivo:linha.
3. Descrever cada estado das imagens; separar dimensões observadas, decisões deste plano e dados apenas ilustrativos.
4. Registrar zonas vermelhas por responsabilidade real e as inconsistências de escopo/integração.
5. Concluir os 19 roteiros e obter revisão independente de desenho e riscos.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Comparar SHA256 dos originais e cópias; nenhum raster editado.
- [ ] Verificar todos os links e arquivos apontados; não inventar nomes/rotas.
- [ ] Revisores conferem DEMO, dinheiro inteiro, fontes oficiais e respeito às alterações anteriores.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Não se aplica à documentação: nenhuma alegação de performance. Inventariar suítes existentes e os limites do discovery.

### Caos e recuperação

Não se injeta falha operacional nesta etapa. Catalogar os ambientes e guardas necessários.

### Segurança

Nenhum .env, bearer token, senha ou chave na documentação. Registrar conta real e depósito simulados como riscos.

## Gate e regra de avanço

19 roteiros existentes, referências verificadas, mapa com evidências, lista de riscos e pareceres independentes sem ressalva documental crítica.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Remover apenas o incremento documental desta feature após comparação com snapshot; preservar documentos anteriores.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "01"
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

