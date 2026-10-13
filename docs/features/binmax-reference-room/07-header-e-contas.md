# Subetapa 07 — Header e contas

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 06 APPROVED.
- Responsáveis: Frontend, marca, compliance e segurança.
- Skills: 01, 02, 04, 12, 13, 14, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/07/`; relatório: `relatorios/07-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Header e contas: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Header da sala nova; AccountSelectorDropdown e adaptadores existentes em passos separados; testes.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Implementar logo/grid/abas/bandeiras/Turbo/adicionar/avatar e depósito conforme hierarquia.
2. Conta DEMO vem da identidade operacional; não usar useState para relabelar DEMO como REAL.
3. Renderizar saldo oficial em centavos; loading/erro explícitos, atualização identificada por sujeito/conta.
4. Trocar/fechar aba reutiliza seleção real do app; nenhuma ordem muda de ativo por callback atrasado.
5. REAL/depósito ficam indisponíveis e explicitamente explicados enquanto a etapa 14 não tiver serviço; isso não certifica funcionalidade REAL.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Dropdown, Escape, foco, fechar aba ativa/inativa e catálogo associado.
- [ ] Logout/troca de usuário descartam cache; evento antigo de carteira não altera sujeito atual.
- [ ] Saldo zero não vira falta de dado nem valor default.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 ciclos de abrir/fechar e trocar abas; teclado/clique simultâneo sem assinatura extra.

### Caos e recuperação

Resposta de carteira atrasada após logout; saldo desconhecido permanece desconhecido.

### Segurança

Token não aparece na URL/DOM/logs; flag não habilita REAL; valores escapados.

## Gate e regra de avanço

Header fiel e contas honestas, saldo oficial, foco e isolamento comprovados.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Inverter apresentação; não restaurar carteira nem dados do usuário.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "07"
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

