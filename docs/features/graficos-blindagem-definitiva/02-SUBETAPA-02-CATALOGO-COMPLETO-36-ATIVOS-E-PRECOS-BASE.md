# Subetapa 02: Catálogo Completo dos 36 Ativos com Preço Base e Precisão

## 1. Problema Identificado
No arquivo `apps/web/src/catalog/assets.ts`, a função `getAssetBasePrice(symbol)` possuía apenas 13 símbolos com preços base cadastrados.
- 23 ativos (como `AUDUSD_OTC`, `USDCAD_OTC`, `USDCHF_OTC`, `EURAUD_OTC`, `SYNTH_VOL_25`, `SYNTH_VOL_75`, etc.) caíam no `return 100.0`.
- Quando o usuário abria o gráfico de AUD/USD no modo visitante ou antes do primeiro tick ao vivo chegar, o gerador de velas gerava velas na cotação 100.00 em vez de 0.65820.
- Quando o feed ao vivo conectava, ocorria um salto bizarro de 100.00 para 0.65820 gerando velas aberrantes de centenas de pontos.

## 2. Solução Arquitetural
1. **Dicionário Estático Unificado `ASSET_BASE_PRICES`**:
   - Mapear com exatidão todos os 36 ativos suportados pelo backend (`scripts/dev-live-feed.mjs` e migração `0010_seed_multi_assets.up.sql`).
   - Categorias:
     - **Forex OTC (18)**: `EURUSD_OTC` (1.08542), `GBPUSD_OTC` (1.29415), `USDJPY_OTC` (153.820), `USDCHF_OTC` (0.86510), `AUDUSD_OTC` (0.65820), `USDCAD_OTC` (1.38450), `NZDUSD_OTC` (0.59820), `EURGBP_OTC` (0.83850), `EURJPY_OTC` (166.950), `GBPJPY_OTC` (199.120), `EURCAD_OTC` (1.50280), `EURAUD_OTC` (1.64890), `GBPAUD_OTC` (1.96620), `GBPCAD_OTC` (1.79210), `AUDCAD_OTC` (0.91120), `AUDJPY_OTC` (101.250), `CADJPY_OTC` (111.120), `NZDJPY_OTC` (92.050).
     - **Cripto OTC (8)**: `BTCUSD_OTC` (64850.00), `ETHUSD_OTC` (3450.00), `SOLUSD_OTC` (152.40), `BNBUSD_OTC` (585.00), `XRPUSD_OTC` (0.5420), `ADAUSD_OTC` (0.3540), `DOGEUSD_OTC` (0.1240), `AVAXUSD_OTC` (28.40).
     - **Commodities OTC (4)**: `XAUUSD_OTC` (2652.80), `XAGUSD_OTC` (31.750), `USOIL_OTC` (72.40), `UKOIL_OTC` (76.20).
     - **Sintéticos (6)**: `SYNTH_VOL_10` (100.5420), `SYNTH_VOL_25` (250.8410), `SYNTH_VOL_50` (500.1250), `SYNTH_VOL_75` (750.3200), `SYNTH_VOL_100` (1000.4500), `SYNTH_CRASH_BOOM_100` (1000.8200).
2. **Atualização de `getAssetBasePrice(symbol)`**:
   - Busca direta por chave no dicionário.
   - Fallback defensivo inteligente por categoria caso surja um símbolo desconhecido, e nunca um valor arbitrário de 100.0 para forex fiduciário.

## 3. Testes Automatizados da Subetapa
- **Teste de Cobertura Integral dos 36 Ativos**:
  - Itera sobre todos os 36 ativos de `ASSET_CATALOG`.
  - Verifica que `getAssetBasePrice(asset.symbol)` retorna um valor não-nulo, positivo e coerente com a classe de ativo (ex: Forex < 250, Cripto BTC > 10.000, Commodities Ouro > 1.000).
  - Garante que `AUDUSD_OTC` retorne estritamente ~0.65820 (e NUNCA 100.0).
