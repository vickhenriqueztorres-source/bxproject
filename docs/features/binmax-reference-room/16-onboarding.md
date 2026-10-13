# Subetapa 16 — Onboarding

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 15 APPROVED.
- Responsáveis: Frontend, UX/fidelidade, segurança e QA.
- Skills: 01, 04, 13, 14, 15, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/16/`; relatório: `relatorios/16-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Onboarding: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Componente tour novo, preferência versionada e integração de apresentação; auth/provisioning separados.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Imagem mostra apenas primeiro passo, ancorado a Monto: propor os passos seguintes como decisão deste plano, roteiro Elige cuánto invertir → Conoce SUBE/BAJA → Consulta tus operaciones em documento; não alegar demais telas fornecidas.
2. Mostrar exclusivamente quando elegível, versão/sujeito corretos; permitir pular/fechar/reiniciar.
3. Ancorar callouts no elemento real após layout/resize; foco/teclado e leitura acessível.
4. Tour não executa clique em SUBE/BAJA, login, depósito ou alteração de saldo.
5. Login/provisionamento oficial permanece no fluxo já validado; tour não decide carteira.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Primeiro acesso/retorno/versionamento/armazenamento negado e usuário trocado.
- [ ] Escape/Tab/ShiftTab, resize, gaveta aberta, mobile e elemento ausente.
- [ ] 20 provisionamentos concorrentes oficiais → uma carteira/um crédito demo; tour somente apresenta.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 ciclos de abrir/pular/reiniciar sem listeners/callouts órfãos.

### Caos e recuperação

Limite de armazenamento, interromper tour por logout/reconexão/resize e retomar sem ordem automática.

### Segurança

Preferência não armazena token/PII; callout escapa HTML; sem clickjacking sobre botão financeiro.

## Gate e regra de avanço

Roteiro documentado, tour acessível e nenhuma ação de domínio automática; baseline preservada.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desligar tour via flag e preservar compatibilidade de preferências.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "16"
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

