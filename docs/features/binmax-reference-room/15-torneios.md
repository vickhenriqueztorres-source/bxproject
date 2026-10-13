# Subetapa 15 — Torneios

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 14 APPROVED.
- Responsáveis: Arquiteto, backend, financeiro, compliance e QA.
- Skills: 01, 02, 04, 05, 08, 09, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/15/`; relatório: `relatorios/15-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Torneios: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Lista futura somente depois de regras/serviço de torneio aprovado; SidebarDock auditado, sem prize/countdown fixo.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Documentar ausência de API e escopo da Fase 1; não apresentar EN VIVO/prêmio/contagem fictícios.
2. Definir contrato oficial: elegibilidade, start/end, ranking, desempate, fee, prize, regras de abuso e auditoria.
3. Aprovar ADR e invariantes financeiros; ranking nunca calculado de resultados locais não verificados.
4. Integrar status/lista/detalhe/inscrição/ranking com estado oficial; UI igual à referência quando serviço existe.
5. Premiação transacional/idempotente via Blnk e reconciliação, com testes descartáveis.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Inscrição única, não elegível, torneio encerrado, empate e ranking determinístico.
- [ ] Eventos duplicados/fora de ordem, prize falso rejeitado, BOLA e resultados somente oficiais.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Perfil definido pelas regras aprovadas; entradas concorrentes e ranking com paginação, medir fairness/latência.

### Caos e recuperação

Restart, torneio fecha durante inscrição e prêmio após falha de Blnk; efeito 1× e conservação.

### Segurança

Antifraude/threat model, RBAC de gestão, abuso de inscrição, prêmio imutável e dados pessoais minimizados.

## Gate e regra de avanço

BLOCKED sem regras/API/escopo. Indisponível honesto não é torneio funcional completo.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desabilitar inscrição/premiação nova; preservar auditoria e ledger.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "15"
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

