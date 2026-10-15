# 08 — Contratos duráveis e liquidação oficial

Agentes: backend, QA, financeiro, segurança e verificador. Skills 01/02/03/04/05/06/08/09/10.
Pré-condição: gate 07 VALIDADA com ordens novas bloqueadas; regra de arredondamento D-19 resolvida e registrada antes de alterar payout.
Escopo: migrations aditivas de referências de tick, criação/settlement/reconciliação; separar cada cadeia em patches próprios.

## Passo a passo

1. Antes do patch, testes RED de restart com contrato OPEN, borda de expiração e repetição concorrente do mesmo settlement.
2. Guardar referência imutável de tick de entrada (symbol/sequence/hash/ts) vinda do servidor. Cliente nunca escolhe preço ou resultado.
3. Versionar regra de liquidação quando houver migração de contratos legados; os antigos não são reinterpretados silenciosamente.
4. Selecionar primeiro tick oficial do símbolo com ts>=expires_at, com desempate documentado por sequence. Sem tick, aguardar; nunca transformar ausência em DRAW.
5. Usar lock/transição condicional/outbox; chamadas Blnk com referências determinísticas. Manter dinheiro inteiro e efeito exatamente uma vez.
6. Recuperar contratos vencidos e reagendar trabalho durável após restart. Confirmar reserva/settlement no ledger antes de estado terminal.
7. Rodar regra nova em sombra sem efeito financeiro; registrar divergências antes de ativar. Sombra não altera payout nem liquidadores ativos.
8. Reconciliar contratos, ticks e ledger; publicar alertas sem UPDATE manual de saldo. Corrigir somente por reversão rastreável.

## Testes de aceite

- AC-GD-08-1: WIN/LOSS/DRAW com ticks de fronteira usam referência correta e valor inteiro exato, com recálculo independente.
- AC-GD-08-2: quatro workers/20 entregas concorrentes geram um settlement e uma transação por reference, soma ledger=0.
- AC-GD-08-3: kill do worker após resposta Blnk e antes do ACK; reentrega mantém um único efeito, inclusive timeout de resultado desconhecido.
- AC-GD-08-4: PG/Redis/Blnk indisponíveis não geram preço/resultado/saldo substituto; recuperação zera pendências e divergência.
- AC-GD-08-5: JWT alg/iss/aud/exp inválidos, BOLA e campos user_id/price/payout/result forjados são recusados pelo backend.
- AC-GD-08-6: restart com contratos abertos preserva timers via fila/estado duráveis; nenhum tick de outro símbolo liquida contrato.

Stress: 300 WebSockets, 50 contratos/min, chaves únicas e 20 repetições concorrentes de chaves selecionadas. Alvos p95 abertura<200ms (ORCHESTRATOR), erro<0,1%, vencidos resolvidos <=10s fora das janelas de falha declaradas.
Caos real exige reconciliação final, soma zero e efeito único. Sem acesso ao Blnk real efêmero, teste fica INCONCLUSIVO.
Rollback: impedir novas ordens, drenar com a versão da regra gravada e manter log; não reverter schema com referências usadas.
Gate: I-01–I-06, S-02–S-06, V-07/V-08/V-09/V-10/V-13. D-19 pendente impede homologação de WIN, sem inventar arredondamento.
