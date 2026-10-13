# Subetapa 02 — Cabeçalho do Ativo no Gráfico e Eixos

**Agentes:** chart-trading-engineer · chief-visual-director · binmax-brand-agent
**Skills:** 11-chart-trading-tools, 21-designer-senior-binmax, 13-textos-es
**Problemas:** P4 (gráfico), P8

## Objetivo
Trocar a pílula "VOL_50 [Digital]" pelo cabeçalho do alvo (C2) e deixar os eixos legíveis.

## Arquivos (lista fechada)
- `apps/web/src/chart/PriceChart.tsx` (cabeçalho ~:860-900 e opções de `priceFormat`/`localization`)
- `apps/web/src/catalog/assets.ts` (só leitura do nome de exibição; função nova `getAssetDisplayName` se não existir)
- `apps/web/src/chart/subetapa-polish-02-asset-header-axes.unit.test.tsx` (novo)

## O que muda (chave ligada)
1. Nome de exibição do catálogo ("Vol 50", "EUR/USD (OTC)"), 16px 600 Blanco; subtítulo "Digital" 12px Aço (texto, não selo verde).
2. ⓘ 🔔 ☆ como botões quadrados 32px `--bg-2`, raio 6px, ícone Aço 16px.
3. Casas decimais do eixo pelo ativo: índices sintéticos 2 casas, FX conforme `pipSize` do catálogo; etiqueta do preço atual com as mesmas casas.
4. Eixo de tempo em `es` (sem "out." em português); fonte 11px Geist Mono, Aço.

## O que NÃO muda
Busca de ativos, troca de ativo, dados de vela, zoom/pan.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | `VOL_50` e `SYNTH_VOL_50` mostram "Vol 50"; `EURUSD_OTC` mostra "EUR/USD"; símbolo desconhecido mostra o símbolo sem `_` e sem `SYNTH_` |
| Unidade | `precision` = 2 para sintéticos, 5 para EUR/USD |
| Segurança | símbolo vindo da URL com `<script>` não é renderizado como HTML; símbolo fora do regex cai no padrão |
| Caos | catálogo sem o ativo → fallback sem erro; troca de ativo 50× seguidas sem vazar listeners |
| Estresse | 1000 chamadas de `getAssetDisplayName` < 10 ms |
| Regressão | `in-chart-asset-selector` (espera `SYNTH_VOL_50`) é ajustado só no ramo com chave ligada |
| Visual | prints on/off |
