# Subetapa 14 — Conta real e depósito

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 13 APPROVED.
- Responsáveis: Arquiteto, backend, financeiro, segurança, compliance e QA.
- Skills: 01, 02, 04, 05, 08, 09, 17; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/14/`; relatório: `relatorios/14-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Conta real e depósito: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: Nenhuma lista de implementação autorizada antes de contrato de conta/PSP; telas existentes apenas auditadas e passos de honestidade separados.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Confirmar escopo: Fase 1 é DEMO; imagens não autorizam inventar serviço REAL/PSP.
2. Registrar dependências: identidade da conta, moeda, regras de funding, provedor oficial, sandbox, webhooks e reconciliação.
3. Enquanto ausentes, impedir relabel DEMO → REAL e falsas confirmações; aviso honesto não fecha esta etapa funcional.
4. Com contrato aprovado, criar ADR e threat model antes de código; PSP e segredo fora do browser.
5. Integrar fluxo sandbox e webhook assinado idempotente, pending/confirmed/failed/refunded oficiais.
6. Somente responsável autorizado realiza ações financeiras reais em UI; agente testa sandbox/descartável.
7. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
8. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Troca de conta não mistura saldo/cache/ordens; chave da intenção captura conta correta.
- [ ] Webhook duplicado/fora de ordem, assinatura inválida, estorno e reconciliação.
- [ ] Cancelar/fechar/duplo clique nunca gera sucesso falso ou reset demo silencioso.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

Concorrência sandbox conforme capacidade oficial; efeito 1× por evento e referência.

### Caos e recuperação

PSP indisponível, resposta ambígua, webhook atrasado, restart do worker e Blnk falho; ledger conserva os valores.

### Segurança

URLs em allowlist, CSRF onde se aplica, assinatura/replay, secrets somente no servidor, BOLA e segregação REAL/DEMO.

## Gate e regra de avanço

BLOCKED enquanto contratos/serviços/escopo inexistentes. Estado indisponível pode aprovar patch de segurança, mas não entrega funcional REAL/depósito.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Desabilitar funding; preservar auditoria, confirmar reversões oficiais; nenhum saldo editado.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "14"
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

