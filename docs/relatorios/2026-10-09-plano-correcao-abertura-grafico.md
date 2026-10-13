# Correção da abertura do gráfico — plano e evidências

## Escopo autorizado

Pedido do autor: corrigir o GAP e as velas grandes que persistem ao abrir o gráfico.
Execução local na branch `codex/fix-chart-boot-gap`. A instrução anterior do autor
autoriza continuidade sem nova revisão humana. Alterações preexistentes preservadas;
copias dos arquivos antes deste passo em `.orchestrator/chart-gap-baseline/`.

## Diagnóstico reproduzido

- O Vite em 5173 pertence a este checkout. A API configurada em 3005 e o feed em
  3006 recusam conexão; `/api/candles` retorna HTTP 500.
- O simulador existente `scripts/dev-live-feed.mjs` escuta 3001 e estava desligado.
  O fallback do navegador gera histórico e ticks de forma independente, aceita
  cache antigo sem verificar idade e não é o backend oficial da Fase 1.
- O Host carrega as duas séries com seed, depois só substitui a série ativa.
  O DataLayer real da biblioteca instalada reproduziu índices `[0,6]` para duas
  velas com cinco minutos intermediários presentes apenas na série oculta.
  Esvaziar a série oculta produz `[0,1]`, sem mudar timestamps nem OHLC.
- `safeCandleFromTick` abre uma nova vela no fechamento anterior, inclusive após
  pausa de vários minutos. Isso incorpora um movimento não observado ao corpo.
- As séries não configuram `priceFormat`: a biblioteca usa duas casas; NZD/USD
  tem precisão cinco no catálogo. A correção antiga de normalização só é importada,
  sem chamada no caminho de renderização.
- Os 34 testes alvo existentes passam, mas testes SSR não executam efeitos nem
  Canvas. Esse resultado não prova resolução visual.

Fontes da biblioteca: [formato de preço v4.2](https://tradingview.github.io/lightweight-charts/docs/4.2/api/interfaces/PriceFormatBuiltIn)
e [visibilidade e timeline v4.2](https://tradingview.github.io/lightweight-charts/docs/4.2/api/interfaces/SeriesOptionsCommon).

## Passo A — ciclo do gráfico

Arquivos: `apps/web/src/chart/PriceChart.tsx`, `IsolatedChartHost.tsx`,
`chart-scale-normalizer.ts`. Responsável: engenheiro gráfico.

1. Usar o histórico recebido pela API; aguardar vazio durante a carga inicial.
2. Manter dados exclusivamente na série ativa e limpar a inativa e cargas vazias.
3. Aplicar precisão/minMove do catálogo nas duas séries e na troca de ativo.
4. Abrir o bucket novo no primeiro tick observado.
5. Preservar barras vivas durante histórico assíncrono e troca de tipo/timeframe;
   cancelar callbacks de frames antigos e manter isolamento por símbolo.

Orçamento de produção: até 3 arquivos e 150 linhas adicionadas/removidas.
Se exceder, dividir e registrar a causa antes de continuar.
Risco: regressão de troca de ativo, tipo, timeframe e histórico tardio.
Volta: aplicar apenas o diff inverso deste passo contra as cópias locais; não
restaurar o checkout inteiro, que já tinha alterações de outros trabalhos.

## Passo B — preview local

Arquivo: `apps/web/vite.config.ts`. Responsável: orquestrador.
Opção explícita de ambiente para apontar REST e WS ao simulador existente em 3001;
padrões 3005/3006 preservados. Iniciar processos locais e verificar HTTP e WS reais.
Orçamento: 1 arquivo e até 20 linhas. Volta: retirar a opção e reiniciar o Vite.

Passo B2: `scripts/dev-live-feed.mjs`, apenas a constante de endereço de escuta:
trocar `0.0.0.0` por `127.0.0.1` para o preview não publicar o simulador na rede.
Orçamento: 2 linhas alteradas; nenhum endpoint ou cálculo é alterado.
Volta: inverter essa única alteração e reiniciar o processo local.

## Provas exigidas

- QA: regressões novas executam o Host real com o DataLayer real; vermelho antes,
  verde depois. Novo bucket, precisão, carga vazia e série oculta incluídos.
- Corrida de histórico tardio preserva extremos e barras já observadas.
- Testes existentes de chart/feed/cache, TypeScript e build do frontend.
- Revisor independente verifica apenas o incremento contra a cópia de base.
- Navegador: abertura NZD/USD, troca de ativo/timeframe/tipo e recarga.
  Capturas antes/depois no mesmo viewport; registrar limitações concretas.

Não reprecificar histórico recebido nem preencher pausas reais com velas inventadas.
Valores financeiros, autenticação, ledger e produção não fazem parte deste passo.

## Passo C — conexão e aviso de pausa na abertura

Na validação local apareceram defeitos adicionais reproduzidos executando a classe
de produção em memória: `subscribeSymbol` muda o estado de staleness para falso
sem avisar listeners já registrados; snapshot/ticks posteriores também deixam
esses listeners presos em verdadeiro. Além disso, três chamadas concorrentes a
`connect(true)` criam três sockets antes do retorno do token bucket; um close de
socket obsoleto pode marcar a conexão atual aberta como desconectada.

Arquivo de produção: `apps/web/src/feed/TradingFeedManager.ts` (zona vermelha,
correção de transporte separada do visual, autorizada pelo pedido de correção e
continuidade sem revisão humana). Worker: bug-fix-agent; QA: teste novo isolado.
Limite: um arquivo e até 100 linhas. Corrigir notificação de estado, exclusão de
handshakes concorrentes e rejeição de callbacks de sockets obsoletos; preservar
protocolo, autenticação, URLs, cálculos e chamadas financeiras. Volta: diff inverso
contra `apps__web__src__feed__TradingFeedManager.ts` na baseline local.
Gate: regressões vermelhas antes, verdes depois; feed antigo e preview com
ticks REST/WS reais e aviso de conexão coerente. Sem declarar catch-up completo.

## Passo A4 — restauração e dimensões

Refinamento C1: regressão reproduziu tick local seq1000/1001 antes de snapshot
do servidor seq40. Isso mistura fontes e impede a observação dos ticks oficiais
no gráfico. O fallback local fica disponível somente com
`VITE_DEMO_OFFLINE_FEED=1`; na abertura normal aguardar o servidor, inclusive
durante indisponibilidade. Mesmo arquivo e orçamento C; não alterar preços.

Host: consultar a série atualmente visível ao restaurar contexto e limpar a
inativa; conectar o ResizeObserver ao host. A mudança de viewport de 750 para
1920 não redimensionou o Canvas durante a reprodução. Limite: oito linhas.

## Estado

Passo D: duas regressões vermelhas provam que REST indisponível retorna cache
de 2023 e resposta oficial vazia é substituída por 60 velas inventadas. Em
`api/client.ts`, respeitar resposta vazia e permitir cache/seed somente no modo
offline explícito. Até oito linhas de produção. Nos três testes existentes de
simulador/cache, declarar `VITE_DEMO_OFFLINE_FEED=1` no setup e restaurar ambiente
no teardown; preservar todas as asserções, limites, casos e timeouts. Essa
configuração explicita o modo que essas suítes exercitam. As novas regressões
provam o caminho online com cache antigo, HTTP vazio e indisponibilidade.

Passo A5: o navegador mostrou as 48h comprimidas no viewport por `fitContent`
no reset de símbolo. Retirar essa chamada (uma linha), mantendo o espaçamento
configurado de 10px e `scrollToRealTime`. Verificar zoom de abertura visualmente;
não modificar amplitude/OHLC do mercado para reduzir velas verdadeiras.

- A1: quatro regressões novas vermelhas, depois verdes; ciclo ativo/inativo,
  carga vazia, precisão de preço e primeiro tick corrigidos. Incremento 33 linhas.
- A2: quatro regressões vermelhas executando PriceChart e DataLayer reais;
  prova de ticks aplicados antes de histórico tardio e rajada anterior ao frame.
  Implementação delimitada: observações de 5s agrupadas por timeframe, união
  com histórico sem reancorar preços, cancelamento de frames antigos e isolamento
  por símbolo. Limite de memória: até 3500 minutos de observações.
- A3: typecheck reproduziu import antigo de `ensureStrictAscendingBars` no teste
  `industrial-hardening.unit.test.ts`. Compatibilidade restaurada com reexport
  de uma linha no Host; a asserção antiga foi preservada. Typecheck passou.
- B1+B2: revisão independente aprovada. REST 60 barras sem lacunas; WebSocket
  snapshot seq86 seguido de tick seq87; REST subsequente tem mesmo bucket e close
  0.59941. Isso verifica o simulador local, não a stack oficial com PostgreSQL.
- A4: regressão vermelha/verde de restauração após trocar para linha e de cauda
  viva posterior às props. Restauração usa `series.data()` atual e esvazia a
  inativa. ResizeObserver conectado; Canvas acompanha viewport 1280/1920.
- A5: abertura mantém espaçamento configurado, sem comprimir as 48h com fitContent.
- Refinamento A2: regressão vermelha/verde para frame que cruza a virada de minuto.
  Histórico REST fechado prevalece; atualização de frame ainda incorpora os
  extremos observados antes do fechamento. São dois contextos distintos no merge.
- C: quatro regressões vermelhas/verde: handshake único, socket obsoleto ignorado,
  staleness coerente e nenhum preço local antes de snapshot de sequência baixa.
- D: duas regressões vermelhas/verde: falha REST não retorna cache antigo ou seed;
  histórico oficial vazio permanece vazio. Suítes antigas de offline/cache mantêm
  suas asserções e declaram o modo offline no setup, restaurando ambiente ao final.

## Resultado local — 2026-10-09 17:06 UTC

Correção aplicada e validada localmente. Preview do simulador existente ativo:
`http://127.0.0.1:5173/?symbol=NZDUSD_OTC`. Feed PID 17296, Vite PID 10652;
PID real do Vite atualizado em `.orchestrator/chart-gap-preview/vite.pid`.
REST e página retornaram HTTP 200. Logs em `.orchestrator/chart-gap-preview/`.

### Comandos e evidência

```text
pnpm exec vitest run apps/web/src tests/unit/chart-boot-gap.test.ts tests/unit/chart-tail-hydration.test.ts tests/unit/feed-connection-lifecycle.test.ts tests/unit/chart-history-source.test.ts --reporter=dot
67 arquivos, 361 testes passaram (343 existentes + 18 regressões novas), 36,24s.

pnpm --filter @broker/web build
tsc + vite build: exit 0; 154 módulos; 20,83s na etapa Vite.
Aviso existente: bundle principal >500kB; limite não alterado.

Git Bash: skills/06-testing-quality/scripts/health-check.sh [os quatro arquivos de regressão]
exit 0, zero violações, nove avisos de domínios fora do escopo unitário.
```

Navegador: recarga NZD/USD em 1m; velas → linha → 5m; NZD → BTC → NZD;
redimensionamento 1280/1920; nova recarga com espera pelo snapshot. Estado final
`Conectado`, cotação atual, escala NZD de cinco casas e nenhuma série oculta
introduzindo espaços na timeline. Saldo demo $10.000 e zero operações durante
a verificação. Screenshot final 1920×1080 em
`prints/chart-gap-2026-10-09/depois-nzdusd.jpg`; antes em `antes-nzdusd.jpg`.
Viewport temporário restaurado ao finalizar. Logs de erro consultados continham
eventos históricos até 16:55 UTC, anteriores à validação final; nenhum posterior
à última recarga às 17:05 UTC foi retornado.

### Limites da conclusão

- O preview usa o simulador local já existente. A amplitude dos movimentos que
  ele gera é mantida; velas amplas vindas dessa fonte não são reduzidas nem
  reprecificadas. O problema de espaços falsos e mistura de fontes foi corrigido.
- A abertura aguarda a conexão escalonada e snapshot: durante essa espera pode
  mostrar reconexão, sem gerar cotações locais para mascarar a espera.
- Não certifica a stack oficial PostgreSQL/Redis/Blnk, nem catch-up completo de
  todos os ticks antes da entrega de props pelo React. Sem alteração financeira.
- Revisão independente de diagnóstico e B1/B2 foi realizada. Os workers depois
  atingiram limite de uso; a revisão final independente do incremento C/D/A4
  ficou pendente. O orquestrador revisou o diff contra as cópias da baseline.
- O health-check global anterior tinha 11 violações preexistentes fora deste
  incremento; não foi enfraquecido. Esta entrega não declara todos os gates da
  Fase 1 concluídos. Governança congelada preservada; sem merge ou publicação.
- Checkout já continha mudanças extensas. As cópias locais permitem inspecionar
  este incremento; build regenerou artefatos em apps/web/dist. Sem commit em
  lote que inclua alterações de outros trabalhos.
