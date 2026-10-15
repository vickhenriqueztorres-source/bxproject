# Gráfico durável — plano de execução e gates

Data: 2026-10-14. Responsável: `tech-lead-orchestrator`.
Pedido: verificar o diagnóstico anexado, testar antes de alterar e executar uma subetapa por vez.

## Resultado pretendido

Reiniciar API, frontend ou produtor não recria o passado, não reinicia sequência/preço e não perde contratos. Todo preço oficial existe no PostgreSQL; candles, replay e liquidação apontam para esse log.

## Diagnóstico confirmado

- `scripts/dev-live-feed.mjs:394`: histórico gerado novamente a partir do minuto atual; `:434` inicializa preço do catálogo, sequência 1 e gênese.
- `scripts/dev-live-feed.mjs:3242`: ticks alteram RAM e seguem ao WebSocket sem transação ticks/outbox.
- `services/tick-engine/src/persistence/tick-repository.ts:61`: estado é incrementado sem conferir predecessor ou hash da sequência efetivamente atribuída.
- Existem motores TS (`src/index.ts`, iniciado pelo package.json) e MJS (`engine.mjs`), com schemas incompatíveis. O último espera `indices.params`, `last_ts`, `outbox`, ausentes na migration inicial.
- Deploys referenciam `broker-feed`; o motor isolado não é automaticamente o caminho utilizado pelo usuário.
- Contratos do monólito usam preço/timer em RAM. Continuidade visual sozinha não valida continuidade financeira.

## Decisões preservadas

Manter CSPRNG (D-07), PostgreSQL como fonte forte (D-05), tick/estado/outbox na mesma transação antes da distribuição (D-08), líder por símbolo com lease e fencing (D-09), cadência atual de 1 Hz (D-13), dinheiro inteiro e Blnk (D-02/D-18).
Não adotar xoshiro/PCG como aleatoriedade de produção, remover outbox, publicar tick não confirmado quando o banco falha, ou chamar escrita descartável em sombra de log oficial. Timestamp/hash são definidos antes do commit; só a publicação ocorre depois. Não prometer variação máxima determinística para um gerador gaussiano: testar retomada do estado e ausência de reset com fonte injetada.
Particionamento, compressão e retenção dependem de medição real; não trocar a imagem do banco da carteira por suposição. Histórico legado exportado terá proveniência explícita e não comprovará liquidação antiga.

## Agentes e skills

| Papel | Responsabilidade | Skills |
|---|---|---|
| Orquestrador | Escopo, dependências, evidências, autorização de avanço | 01, 06, 09, mudança cirúrgica |
| broker-architect-agent | Causa raiz, ADR, concorrência e contratos entre runtimes | 01, 02, 03, 05, 08, 09 |
| codebase-mapper-agent | Caminho real de boot/feed/chart/deploy | 01, 03, 11 |
| qa-resilience-agent | Oráculos prévios, banco/fila reais, stress e caos | 01, 05, 06, 07, 08, 09 |
| backend-implementation-agent / bug-fix-agent | Um passo backend delimitado por vez | 01–09 conforme escopo |
| chart-trading-engineer | Consumo v2 sem inventar OHLC | 01, 03, 06, 11 |
| security-reviewer / financial-correctness-reviewer | Revisão independente de segurança/dinheiro | 01, 02, 04, 05, 08, 09 |
| regression-guardian-agent / post-implementation-verifier | Comparação com base, execução e pós-condições | 06, 09, 10 |

## Ordem obrigatória

| ID | Documento | Entrega |
|---|---|---|
| 01 | [Diagnóstico e baseline](01-DIAGNOSTICO-E-BASELINE.md) | Inventário, reprodução, ambiente isolado e oráculos |
| 02 | [Atomicidade do repositório](02-ATOMICIDADE-REPOSITORIO.md) | Rejeitar predecessor/hash incompatíveis sem efeitos parciais |
| 03 | [Schema e runtime](03-SCHEMA-E-RUNTIME.md) | Um contrato de dados migrável do zero e por upgrade |
| 04 | [Liderança e relógio](04-LIDERANCA-E-RELOGIO.md) | Fencing completo, geração serial e retomada do estado |
| 05 | [Outbox e replay](05-OUTBOX-E-REPLAY.md) | Publicação recuperável e ordenada por símbolo |
| 06 | [Candles oficiais](06-CANDLES-OFICIAIS.md) | Agregação idempotente e reconstruível, endpoint v2 |
| 07 | [Bootstrap e transição](07-BOOTSTRAP-E-TRANSICAO.md) | Preservar legado, eliminar reset e separar produtor |
| 08 | [Contratos duráveis](08-CONTRATOS-E-LIQUIDACAO.md) | Entrada/saída auditáveis e recuperação após restart |
| 09 | [Gateway e cliente](09-GATEWAY-E-CLIENTE.md) | Replay completo, staleness honesta e compatibilidade |
| 10 | [Gráfico e regressão](10-GRAFICO-E-REGRESSAO.md) | Usar candles reais e preservar UI/layout |
| 11 | [Operação e certificação](11-OPERACAO-E-CERTIFICACAO.md) | Restore, capacidade, auditoria e homologação final |

## Gate comum de cada subetapa

1. Fixar HEAD, hash dos arquivos do passo e diff inicial, incluindo trabalho local de terceiros.
2. Escrever critérios Dado/Quando/Então e oráculos; provar vermelho contra o defeito real antes de editar produto.
3. Delimitar arquivos; passos de até 5 arquivos/150 linhas. Dividir testes maiores em passos próprios. Mudanças backend sensíveis são parte expressa deste pedido; não misturar UI ou finanças sem seus revisores.
4. Implementar apenas a cadeia causal. Preservar assinaturas/compatibilidade sempre que possível.
5. Executar testes unitários, integração real, abuso, concorrência, falhas e stress aplicáveis. Nenhum mock de PostgreSQL/Redis/Blnk em integração.
6. Comparar com baseline; falha preexistente recebe evidência e continua bloqueando qualquer garantia que dependa dela. Nenhuma falha nova é tolerada.
7. Revisores independentes e verificador conferem V-02/V-04/V-05 e demais pós-condições tocadas; registrar logs, versões, duração e fingerprint. Testes locais não substituem artefato CI exigido pela skill 09.
8. Só marcar VALIDADA e iniciar a próxima com todos os critérios aplicáveis atendidos. FAIL/INCONCLUSIVO mantém gate fechado. Nenhum `.skip`, retry para esconder flaky ou relaxamento de asserção.

Caos somente em recursos novos identificados por execução, nunca nos containers compartilhados `fase1-test-*` nem em produção. Nada de `stack:reset`, limpeza global ou rollback que apague trabalho alheio. Uma flag desligada não é rollback válido depois que existem contratos dependentes do novo log; rollback deve preservar o produtor/log e drenar consumidores com segurança.

Estado e resultados efetivos: [EXECUCAO.md](EXECUCAO.md). Este plano não declara implementação nem homologação das etapas futuras.
