# Subetapa 17 — Mobile e tablet

## Controle

- Status inicial: PLANNED. O estado efetivo está em [ESTADO.md](ESTADO.md).
- Dependência: gate 16 APPROVED.
- Responsáveis: Cirurgião, fidelidade, chart e QA.
- Skills: 01, 11, 13, 14, 15, 17, 19; ler os arquivos reais antes do handoff.
- Evidência: `.orchestrator/binmax-reference-room/17/`; relatório: `relatorios/17-resultado.md`.
- Protocolo obrigatório: [PROTOCOLO-GATES.md](PROTOCOLO-GATES.md).

## Objetivo e fronteira

Mobile e tablet: entregar somente o incremento previsto, preservando o estado anterior e as invariantes do plano geral.

Arquivos/responsabilidade previstos: MobileTraderoomLayout/MobileBottomNav e CSS escopado; mesma fonte de estado do App.

Nenhum arquivo candidato é autorização para refatoração ampla. Antes de cada passo, publicar lista fechada de até cinco arquivos e orçamento de até 150 linhas de código alteradas. Subdividir quando necessário. Ler os arquivos inteiros e mapear consumidores. Backend, dinheiro, autenticação, tempo e feed exigem passo próprio e revisão do domínio; não entram escondidos em alteração visual.

## Passo a passo

1. Montar layout mobile real usando mesmos hooks/estado; não manter chart/ticket ocultos duplicados.
2. Reorganizar header/chart/ticket/navbottom a partir do mosaico; não assumir pixels nativos da miniatura.
3. Alvos touch de pelo menos 44 × 44 px, admitindo espaçamento de 8 px entre alvos quando a área visual precisar ser menor, aviso de risco acessível, safe areas e keyboards.
4. Gavetas/modais seletores adaptam viewport; orientação não perde intenção ou contrato.
5. Tablet 768 × 1024 e telefones 390 × 844/360 × 800 com zoom/teclado virtual; controles sem clipping.
6. Executar as verificações abaixo, revisar o diff incremental e submeter as provas aos revisores indicados.
7. Gravar comando, exit code, descoberta, checkout testado, artefatos, lacunas, veredito e rollback; atualizar ESTADO.md.

## Testes e aceitação

- [ ] Mesmo contrato/saldo/ativo durante mudança de breakpoint; uma assinatura de feed.
- [ ] Duplo touch, scroll, foco, orientação e keyboard virtual; contraste/SR.
- [ ] Screenshots dos mesmos estados desktop/mobile e OFF comparado.
- [ ] Executar regressões relevantes da base e checagens de tipos/build/lint aplicáveis; zero testes descobertos não é aprovação.
- [ ] Rever cada linha do incremento e comparar OFF com a base nos passos de produto.
- [ ] Nenhum dinheiro em float, saldo/resultado inventado, token em log ou teste protegido enfraquecido.

### Stress

1000 mudanças de breakpoint/harness e browser com mudança de orientação; memória/WS sem crescimento.

### Caos e recuperação

Background 5 min, rede celular intermitente e keyboard fecha; recuperação e ordem ambígua preservadas.

### Segurança

Nenhuma API/guard desabilitada no mobile; aviso DEMO/risco e RBAC mantidos.

## Medição e exceções

Exigir hitbox ≥ 44 × 44 px nos controles operacionais e navegação. Exceção: registrar alvo/dimensão/justificativa e revisão prévia, sem esconder ações. Desenho visual pode ser menor que hitbox. Recursos vivos retornam ao baseline após desmontagem; heap estabiliza após aquecimento/GC, não precisa igualdade instantânea.

## Gate e regra de avanço

Toda matriz navegável no mobile/tablet, sem engine duplicado ou perda de intenção; visual/revisores aprovam.

Um teste obrigatório falhou ou não foi executado: FAILED/BLOCKED, corrigir esta subetapa antes de começar a próxima. Dados simulados devem ser explicitamente identificados; não certificam integração financeira real. Registrar N/A apenas com justificativa e revisão. Aprovação depende de prova, não de uma promessa ou imagem bonita.

## Rollback

Flag OFF ou inverso do layout responsivo, sem limpar estado financeiro.

Registrar snapshot seletivo antes do incremento. Nunca executar reset --hard, git add -A, down -v ou restaurar um arquivo inteiro apagando trabalho anterior. Não incluir segredos no snapshot/commit.

## Handoff mínimo

```yaml
feature: BMR-2026-10-09
stage: "17"
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

