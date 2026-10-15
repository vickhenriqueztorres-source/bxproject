# 09 — Gateway, replay e reconexão

Agentes: backend, frontend-realtime/chart, QA, segurança e verificador. Skills 01/03/04/05/06/09/10/11.
Pré-condição: gate 08 VALIDADA. Escopo dividido: gateway/protocolo; manager; hook de resync, em passos distintos sem alterar layout.

## Passo a passo

1. Escrever RED contra gateway real: snapshot concorrente com ticks ao vivo, gap de 20 sequências, replay antigo e reconexão após restart.
2. Assinar fonte ao vivo antes do snapshot, delimitar watermark, buscar sequência faltante completa em Stream/Postgres e deduplicar ao sair para live.
3. Todas mensagens carregam symbol/sequence/hash/event_time; transporte não substitui event_time por agora para maquiar preço antigo.
4. Separar aplicação de replay histórico de detecção de frescor do último preço. Não descartar histórico válido apenas por ser antigo.
5. Fora da retenção retornar resync_required; conectar callback do hook à invalidação de candles. Não somente carregar um snapshot do último preço.
6. Preservar campos legados enquanto clientes antigos estiverem ativos; capacidades/protocolo versionados. Evitar que sequence volte a 1 silenciosamente.
7. Aplicar limites de conexão/símbolos, buffers, autenticação e fechamento na expiração; cliente não publica tick nem altera histórico.

## Testes de aceite

- AC-GD-09-1: gap 1/20/50/maior que retenção é preenchido integralmente ou exige resync explícito; nenhuma sequência omitida/duplicada no consumidor.
- AC-GD-09-2: ticks durante snapshot não desaparecem; concorrência de subscribe/unsubscribe não mistura ativos.
- AC-GD-09-3: snapshot com event_time antigo continua stale; replay não libera ordem com último tick vencido.
- AC-GD-09-4: resync invalida e recarrega candles e observações do símbolo correto; nenhum recurso órfão após 1.000 ciclos.
- AC-GD-09-5: JWT inválido/expirado, sexto socket e 11º símbolo são recusados; sem pong fecha <=45s; mensagens abusivas são limitadas.

Stress: 300 conexões reais, 1.000 ciclos de reconnect, slow consumer e storm de 200 mensagens/s; atraso tick→WS p95<500ms, buffers limitados e memória/listeners retornam à base dentro da janela medida.
Caos: cortar conexão, parar Redis, reiniciar gateway e perder janela de retenção; SQL/Stream provam continuidade, não apenas estado CONNECTED.
Rollback: manter protocolo antigo com campos aditivos; não apontar clientes novos para feed RAM após contratos usarem log oficial.
Gate: V-02/V-05/V-11/V-12/V-13, segurança e regressão com configs antigas/novas.
