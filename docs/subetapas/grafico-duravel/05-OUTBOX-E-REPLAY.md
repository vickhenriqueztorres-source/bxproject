# 05 — Publicação durável, ordenação e replay

Agentes: backend, QA, arquiteto e verificador. Skills 01/03/05/06/08/09/10.
Pré-condição: gate 04 VALIDADA. Escopo: relay e contrato de evento do runtime escolhido; não alterar liquidação.

## Passo a passo

1. Criar RED contra relay real: pausar após seleção e executar segundo relay; forçar N+1 antes de N e crash entre XADD/marcação.
2. Selecionar outbox confirmado em transação com lock válido; serializar ticks por símbolo. IDs explícitos por sequência, payload contendo preço string, ts, hash e prev_hash.
3. Publicar, confirmar identidade/conteúdo no Stream e só então marcar processamento. Erro de ID menor não prova duplicata: consultar sequência existente antes de reconhecer.
4. Recuperar pendências após crash; deadline/retry limitado/jitter e tratamento de poison message. DLQ não perde mensagem financeira por retenção.
5. Definir retenção de Stream e resync fora da janela sem apagar a fonte PostgreSQL. Não usar Pub/Sub como fila de trabalho.
6. Medir lag de outbox/Stream e recuperação; repetir com publicação em andamento e PostgreSQL/Redis lentos.

## Testes de aceite

- AC-GD-05-1: commit não efetuado nunca aparece no Stream; commit efetuado sem relay aparece depois de retomar relay.
- AC-GD-05-2: crash antes/depois do XADD e antes da marcação resulta em efeito lógico único, com sequência ordenada e payload igual ao banco.
- AC-GD-05-3: dois relays concorrentes não saltam N nem reconhecem N ausente como duplicata; divergência de payload falha explicitamente.
- AC-GD-05-4: Redis fora 60s deixa trabalho pendente; após retorno, lag zera e nenhum preço oficial desaparece.
- AC-GD-05-5: mensagem inválida não bloqueia recursos sem limite e gera evidência observável; nenhum segredo nos logs.

Stress: 36 símbolos ×1 Hz, atraso acumulado de 60s e recuperação sob 300 clientes de leitura; thresholds definidos antes da execução: lag normal <=5s e zero perda/duplicação lógica. Backlog após falha deve zerar em janela declarada no relatório.
Segurança: evento rejeita campos/tipos inválidos, tamanho limitado e role relay não altera tick. Caos real em containers UUID; confirmar falha injetada.
Rollback: manter outbox pendente, suspender relay novo e retornar consumidor compatível; nunca marcar eventos como processados manualmente.
Gate: V-02/V-04/V-05/V-13 e zero falsos ACKs; logs CI e revisão independente.
