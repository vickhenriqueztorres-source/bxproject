# Subetapa 4 — Internacionalização (`i18n`) e Integração UI (`TradersMoodBar.tsx` + `PriceChart.tsx`)

**Projeto**: Binmax (`brokerproject`)  
**Branch**: `fix/traders-mood`  
**Agentes**: `surgical-frontend-agent` + `chart-trading-engineer` + `binmax-brand-agent` + `compliance-risk-reviewer` + `regression-guardian-agent`  
**Skills**: `11-chart-trading-tools`, `12-tokens-binmax`, `13-textos-es`, `15-chave-sala-nova`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`  
**Arquivos Editados**:
- `apps/web/src/i18n/locales/pt-BR/common.json`
- `apps/web/src/i18n/locales/es-MX/common.json`
- `apps/web/src/i18n/locales/es-CO/common.json`
- `apps/web/src/i18n/locales/es-AR/common.json`
- `apps/web/src/i18n/locales/es-CL/common.json`
- `apps/web/src/i18n/locales/es-PE/common.json`
- `apps/web/src/chart/TradersMoodBar.tsx`
- `apps/web/src/chart/PriceChart.tsx`
- `apps/web/src/chart/subetapa-ux-03-mood-bar.unit.test.tsx`

**Commits**:
1. `feat(i18n): add mood translation keys for pt-BR and es locales`
2. `fix(chart): wire real market sentiment into PriceChart and TradersMoodBar`

---

## 1. Internacionalização (`apps/web/src/i18n/locales/**`)

Adicionar exclusivamente o objeto `mood` com as 4 chaves autorizadas (`mood.up`, `mood.down`, `mood.aria`, `mood.lowSample`) em `common.json` de cada locale:

### 1.1 Português (`pt-BR/common.json`)
```json
  "mood": {
    "up": "ALTA",
    "down": "BAIXA",
    "aria": "Sentimento do mercado: {{bulls}}% ALTA, {{bears}}% BAIXA",
    "lowSample": "poucas posições abertas"
  }
```

### 1.2 Espanhol (`es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE`)
```json
  "mood": {
    "up": "SUBE",
    "down": "BAJA",
    "aria": "Sentimiento del mercado: {{bulls}}% SUBE, {{bears}}% BAJA",
    "lowSample": "pocas posiciones abiertas"
  }
```

---

## 2. Atualização do `TradersMoodBar.tsx`

1. **Props**:
   ```ts
   export interface TradersMoodBarProps {
     bullsPercentage: number;
     neutral?: boolean;
   }
   ```
2. **Remoção do clamp duplicado 5–95%**:
   - Manter apenas o arredondamento seguro (limitado a `[0, 100]` contra entradas fora de faixa):
     ```ts
     const rawBulls = Number.isFinite(bullsPercentage)
       ? Math.min(100, Math.max(0, Math.round(bullsPercentage)))
       : 50;
     const bulls = neutral ? 50 : rawBulls;
     const bears = 100 - bulls;
     ```
3. **Rótulos e `aria-label` via i18n**:
   - Usar `useTranslation()` de `../i18n`.
   - Resolver `mood.up`, `mood.down`, `mood.aria` e `mood.lowSample` (via `common.mood.*` / `mood.*`, com fallback para espanhol quando `isI18nActive === false` fora de um `<I18nProvider>`, preservando snapshots legados quando não há provider).
   - Em `pt-BR`: rótulos `"ALTA"` e `"BAIXA"`, `aria-label="Sentimento do mercado: 52% ALTA, 48% BAIXA"`.
   - Em `es-*`: rótulos `"SUBE"` e `"BAJA"`, `aria-label="Sentimiento del mercado: 52% SUBE, 48% BAJA"`.
4. **Visual Neutro (`neutral === true`)**:
   - Proporção `50% / 50%` (`bulls = 50, bears = 50`).
   - Opacidade reduzida (`opacity: 0.55`) e atributo `data-neutral="true"`.
   - Tooltip (e `title` informativo) exibindo a mensagem de amostra pequena (`"poucas posições abertas"` / `t('common.mood.lowSample')`).

---

## 3. Edição Cirúrgica do `PriceChart.tsx`

Tocar **exclusivamente** nas linhas do sentimento:
1. **Import**:
   - Adicionar `import { useMarketSentiment } from './useMarketSentiment';`
2. **Linha 133**:
   - Substituir `const [sentimentBulls, setSentimentBulls] = useState(64);` por:
     ```ts
     const { bulls: sentimentBulls, neutral: sentimentNeutral } =
       typeof useMarketSentiment === 'function' ? useMarketSentiment(symbol) : { bulls: 50, neutral: true };
     ```
3. **Linhas 323–330**:
   - Remover `setSentimentBulls((prev) => Math.min(88, Math.max(45, prev + 1)));` e `setSentimentBulls((prev) => Math.max(25, Math.min(65, prev - 1)));`, mantendo intactos `setPriceDirection('UP')` e `setPriceDirection('DOWN')`.
4. **Linhas 1423–1465**:
   - Remover a caixa inline duplicada `{/* Trader Sentiment Bar (Sentimento da Comunidade Legado) */}`.
5. **Linha 1531**:
   - Atualizar `<TradersMoodBar bullsPercentage={sentimentBulls} neutral={sentimentNeutral} />`.

**PROIBIDO tocar em**: `observed.current`, `mergeObservedCandles`, séries/velas, escala, seletores de ativos ou overlays de tempo/ordens.

---

## 4. Testes Obrigatórios da Subetapa 4

1. **Testes de i18n e UI (`TradersMoodBar`)**:
   - Com `<I18nProvider initialLocale="pt-BR">`: renderiza `"ALTA"`, `"BAIXA"` e `aria-label` em português.
   - Com `<I18nProvider initialLocale="es-MX">`: renderiza `"SUBE"`, `"BAJA"` e `aria-label` em espanhol.
   - Com `neutral={true}`: renderiza `50% / 50%`, opacidade reduzida (`data-neutral="true"`) e texto `"poucas posições abertas"`.
   - Arredondamento sem o clamp `5–95%` (ex.: `bullsPercentage={73.6}` → `74%` / `26%`; `bullsPercentage={100}` → `100%` / `0%`).
2. **Atualização dos testes existentes**:
   - Atualizar `apps/web/src/chart/subetapa-ux-03-mood-bar.unit.test.tsx` (teste `3.3` que validava o antigo clamp `5–95%` passa a validar o arredondamento direto e o modo `neutral`).
   - Confirmar que `subetapa-polish-05-time-mood.unit.test.tsx`, `subetapa-18-03-grafico-overlays.unit.test.tsx`, `subetapa-04-chart-overlays.unit.test.tsx`, `chart-tail-hydration.test.ts`, `chart-memory-leak-lifecycle.test.ts` e `chart-websocket-unmount-guard.test.ts` passam 100%.

---

## 5. Passo a Passo de Execução

1. Atualizar `apps/web/src/i18n/locales/**/common.json` e commitar (`feat(i18n): add mood translation keys for pt-BR and es locales`).
2. Atualizar `apps/web/src/chart/TradersMoodBar.tsx`, `apps/web/src/chart/PriceChart.tsx` e os testes de UI.
3. Rodar toda a bateria de testes de frontend e unitários.
4. Commitar (`fix(chart): wire real market sentiment into PriceChart and TradersMoodBar`).
