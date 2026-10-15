# 10 — Consumir candles oficiais sem regressão visual

Agentes: chart-trading-engineer, QA, guardião, fidelidade visual e verificador. Skills 01/03/06/09/10/11, regressão visual; conduzir-etapa se houver mudança de sala/layout.
Pré-condição: gate 09 VALIDADA; testes visuais baseline relevantes sem pendências.
Escopo: adapter e pontos de consumo do gráfico, delimitados por patch. Arena é consumidor compartilhado; trabalho local de terceiros é preservado.

## Passo a passo

1. Criar RED com histórico 5s/15s/30s oficial, ticks e vela fechada do servidor. Comparar dados do gráfico com fonte real.
2. Selecionar v2 por configuração desligada por padrão; passar candles nativos sem dividir OHLC de 1m para inventar histórico menor.
3. Substituir vela provisória por oficial fechada sem duplicar volume ou remover observações válidas. Bucket/tempo seguem contrato backend.
4. Recarregar histórico quando resync exigir; corrigir paginação para manter lote antigo solicitado sem salto de viewport. Não reescrever preços passados para encaixar no tick atual.
5. Exercitar troca rápida de ativos/timeframes, zoom/scroll, indicadores/desenhos/flags e Arena. Separar patch de dados de qualquer patch visual.
6. Executar flag desligada e ligada com mesmas fontes e comparar layout/comportamento. Não remover caminho antigo antes de janela de compatibilidade e homologação.

## Testes de aceite

- AC-GD-10-1: dados exibidos em cada bucket fechado são idênticos ao endpoint v2 e recálculo de ticks; zero OHLC fabricado.
- AC-GD-10-2: restart/reconnect mantém prefixo histórico e posições de drawings, sem reset de sequência/preço.
- AC-GD-10-3: paginação acrescenta as barras pedidas sem descartar imediatamente o lote e sem alterar viewport inesperadamente.
- AC-GD-10-4: troca de ativo/timeframe e 1.000 mounts/unmounts não mistura buffers, ordens, desenhos nem listeners.
- AC-GD-10-5: dados inválidos/grandes e eventos de outro símbolo são rejeitados; payload não executa HTML/script.

Stress: burst de ticks/replay com quatro gráficos; medir frame time, commits React e memória com thresholds congelados antes da mudança. Não afrouxar limite de teste preexistente para aprovar.
Caos: endpoint lento/500, WS cortado no meio de snapshot, resync repetido e aba suspensa; UI mostra indisponibilidade real e preserva ordens confirmadas.
Regressão: testes existentes de chart/feed/ordens e screenshots nos mesmos viewports; se houver alteração visual, teste de sobreposição e revisão de fidelidade/brand.
Rollback: desligar consumo v2 mantendo backend/log/contratos oficiais e compatibilidade de clientes. Não restaurar síntese de preço como fallback financeiro.
Gate: zero divergência de candles e regressão, segurança dos dados e V-06/V-11/V-13.
