# Subetapa 05 — Tokens e marca

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 04 APPROVED.
- Responsáveis: Cirurgião, marca e fidelidade.
- Skills: 12, 13, 14, 15, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/05/`; relatório: `relatorios/05-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Tokens e marca: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: CSS escopado da sala nova e componentes puramente visuais delimitados; assets existentes somente leitura.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Aplicar paleta azul/ciano inferida das novas referências em tokens exclusivos; não substituir tokens globais antigos.
2. Usar logo oficial curto e fontes existentes, sem dependências/fontes externas novas.
3. Definir estados hover/focus/disabled e contraste; cor não é única indicação de resultado.
4. Traduzir microcopy via sistema existente; nomes internos e chaves financeiras permanecem.
5. Não alterar medidas neste passo; conferir isolamento OFF.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Screenshots dos tokens em estados normal/hover/foco/disabled e comparação de áreas externas.
- [ ] Verificar carregamento de fontes/logo, contraste e texto espanhol sem overflow.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Alternar tema/montagem 1000 vezes; nenhum stylesheet global acumulado.

### Caos e recuperação

Fonte indisponível mantém fallback legível sem ocultar ações ou risco.

### Segurança

Sem HTML injetado, URL remota de asset não autorizada ou CSS que esconda avisos.

## Gate e regra de avanço

Tokens revisados, CSS isolado, contraste WCAG AA: 4,5:1 para texto normal, 3:1 para texto grande e componentes essenciais e OFF idêntico; sem alteração de medidas/lógica.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Remover apenas tokens/regra escopada nova; manter assets e tema anterior.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "05"
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

