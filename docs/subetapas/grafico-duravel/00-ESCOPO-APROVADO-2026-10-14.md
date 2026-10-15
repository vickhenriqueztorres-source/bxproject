# Escopo aprovado — continuidade do feed e liquidação

O pedido de 2026-10-14 limita a execução a quatro resultados: corrigir o feed em uso, persistir ticks antes do uso, recuperar/liquidar contratos por tick persistido e derivar velas desse log. As propostas adicionais em `00-PLANO-GERAL.md` e nos documentos 01–11 são referência técnica, não autorização para ampliar o produto. Nenhuma troca de fonte do frontend ou adoção de Redis Streams ocorre antes dos gates abaixo.

## Caminho confirmado e pré-condições

`scripts/dev-live-feed.mjs` é o produtor e gateway que os scripts de deploy reiniciam. No boot ele cria 10.080 velas por ativo, preço de catálogo, sequência 1 e estado em RAM. O loop emite ticks por WebSocket antes de qualquer escrita em `ticks`. O módulo local `scripts/lib/settlement-engine.mjs` recupera alguns contratos, mas decide preço de saída a partir de histórico em RAM ou fallback, e pode liquidar após falha do banco; ele não satisfaz o gate financeiro. A migration 0010 não aplica sobre 0001 num PostgreSQL vazio porque faltam `indices.params` e `index_state.last_ts`. Há alterações locais de terceiros nesses arquivos: preservá-las e comparar diffs antes de editar.

As duas primeiras necessidades são um único corte operacional: restaurar estado no boot sem gravar cada tick ainda deixaria preços visíveis e descartáveis. Portanto o trabalho pode ser preparado em passos menores, mas o gate A só fecha quando **continuidade e persistência pré-uso funcionarem juntas**. Até lá não promover nem reiniciar o feed compartilhado.

## Gate A — feed ativo, log oficial e produtor único

1. Congelar baseline de `dev-live-feed.mjs`, migrations e testes; reproduzir reset, histórico regenerado e tick visível sem linha no PostgreSQL. Usar apenas PG/Redis locais descartáveis com guarda contra produção.
2. Corrigir a cadeia de migrations e testar instalação vazia e upgrade preservando `indices`, `index_state`, `ticks`, `contracts` e outbox. Seed de ativo novo uma vez; nunca sobrescrever cabeça existente.
3. Criar fronteira de escrita única para tick/estado/outbox na mesma transação. Validar preço decimal canônico, hash da sequência atribuída, timestamp monotônico, lease TTL e fencing; falha de qualquer dependência pausa a geração/publicação.
4. Inicializar preço, sequência, hash e histórico oficial do PostgreSQL no caminho em uso. Só liberar REST/WS e abertura de contrato quando o bootstrap terminar; não fabricar passado a cada reinício. Compatibilidade de símbolo/precisão/forma de resposta é critério de regressão.
5. Publicar somente tick confirmado; clientes que reconectam recebem sequência crescente, sem declarar como oficial qualquer candle legado sem proveniência. Redis Streams fica fora deste gate; outbox é requisito transacional, relay/replay somente se necessário ao fluxo durável definido.

**Provas para fechar:** restart de dois processos sobre a mesma base, 20 escritores concorrentes por ativo e dois ativos simultâneos, falha real de INSERT/COMMIT e sessão PostgreSQL terminada, perda/expiração de lease Redis, relógio retrocedendo, hash e outbox 1:1, zero broadcasts/contratos baseados em tick não confirmado. Teste de carga do caminho de 36 ativos mede taxa, p95, erros e lacunas; limite só será aceito após medição da base. Verificações de entrada maliciosa e ausência de segredo em log. Nenhum teste desabilitado ou mudança de asserção para obter verde.

## Gate B — contratos abertos e liquidação durável

1. Registrar RED de contrato aberto que atravessa restart, timer perdido, dois liquidadores e primeiro tick atrasado. Usar Blnk e PG reais descartáveis. Revalidar identidade, `Idempotency-Key` e saldo no Blnk; nenhum preço, payout, saldo ou `user_id` do cliente.
2. Abrir somente com tick de entrada oficial confirmado e referência idempotente. Recuperar `OPEN` do PostgreSQL por varredura; timer só pode acelerar a varredura, nunca ser fonte de verdade.
3. Trancar cada contrato (`FOR UPDATE` ou atualização equivalente com transação), buscar no PostgreSQL o **primeiro** tick do símbolo com `ts >= expires_at`; sem tick, manter `OPEN`. Gravar `exit_tick_sequence`, resultado e evento de pagamento de modo recuperável, com referências Blnk idempotentes e sem `UPDATE users.demo_balance_minor` como contabilidade.

**Provas para fechar:** restart antes/depois de expirar, tick ausente, tick concorrente, 20 liquidadores, morte do processo em cada fronteira PG/Blnk/outbox, retry após timeout de confirmação, soma contábil e reconciliação, BOLA/IDOR, JWT inválido, mass assignment, duplo POST e reenvio de chave. Qualquer payout 2×, fallback de preço, contrato perdido ou status `SETTLED` sem pagamento rastreável reprova.

## Gate C — velas derivadas e corte de leitura

1. Escrever oráculos para buckets UTC `[início, fim)`, OHLC por menor/maior `sequence`, extremos, volume igual à contagem de ticks, duplicatas e chegada fora de ordem.
2. Reconstruir ou consultar velas somente a partir de `ticks` persistidos; upsert idempotente por `(symbol, interval, bucket_start)` se houver materialização. Fonte do `/candles` passa a ser oficial somente depois de comparar resposta antiga/nova e distinguir histórico legado sem ticks.
3. Testar rebuild completo, restart no meio do bucket, dois consumidores, perda de conexão, replay duplicado, paginação/intervalos, 36 ativos e carga REST+WS simultânea. Verificar `close` de cada vela contra último tick e não permitir que uma vela mais antiga sobrescreva a nova.

**Provas para fechar:** consulta independente ao PostgreSQL recalcula amostra e compara 100% dos OHLCV, hashes de tick intactos, nenhum reset visível, nenhuma falha nova na suíte atual, typecheck/build, testes de stress, caos e segurança aplicáveis, revisão independente e pós-condições executadas. O frontend permanece na fonte anterior enquanto o gate não fechar.

## Regra comum de avanço

Cada passo exige oráculo RED antes do patch, teste verde sobre dependências reais, comparação com baseline, revisão do diff e evidência em `EXECUCAO.md` (comando, ambiente, contagem, falhas, duração). `FAIL` ou `INCONCLUSIVO` mantém o gate fechado. Não executar caos em infraestrutura compartilhada. Não fazer deploy ou trocar a fonte visual durante esta execução sem todos os gates completos e revisão do corte.
