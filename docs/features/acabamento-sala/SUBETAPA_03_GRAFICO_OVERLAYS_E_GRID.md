# SUBETAPA 03 — ENGENHARIA GRÁFICA, OVERLAYS E GRID LIMPO
## Eliminação de Etiqueta Duplicada, Ancoragem da Toolbar, TradersMoodBar e TimeLinesOverlay

**Data:** 09/10/2026  
**Responsáveis:** `chart-trading-engineer`, `surgical-frontend-agent`, `guardiao-regressao`  
**Escopo de Arquivos Autorizados:**
- `apps/web/src/chart/PriceChart.tsx`
- `apps/web/src/chart/ChartDrawingToolbar.tsx`
- `apps/web/src/chart/TradersMoodBar.tsx`
- `apps/web/src/chart/TimeLinesOverlay.tsx`
- `apps/web/src/chart/IsolatedChartHost.tsx`
- `apps/web/src/components/header/TerminalHeader.tsx`

---

## 1. Objetivos Técnicos e Mudanças Cirúrgicas

1. **Eliminação da Etiqueta Duplicada de Preço:**
   - Em `PriceChart.tsx`, remover a propriedade `title: price.toFixed(...)` na chamada de `createPriceLine` da cotação viva.
   - Manter a renderização unicamente no eixo de preços nativo da Lightweight Charts (`axisLabelVisible: true`), configurando a precisão adequada por categoria de ativo (5 casas decimais para Forex, 2 para Cripto e Sintéticos).
2. **Reposicionamento do Painel de Ferramentas Flutuante:**
   - Em `ChartDrawingToolbar.tsx`, fixar a barra no canto inferior esquerdo do gráfico (`bottom: 20px, left: 16px`), exatamente como na IQ Option, eliminando qualquer colisão com a barra de sentimento que reside no terço superior.
3. **Saneamento da TradersMoodBar:**
   - Ampliar o container da barra de sentimento para largura suficiente (mínimo de 60px) para exibir o texto limpo "SUBE 55%" no topo e "BAJA 45%" na base, sem truncamento de texto ("SU...").
   - Remover os fundos coloridos maciços e caixas recortadas das tags, usando texto limpo em cinza `#8A92A1` e números destacados.
4. **Refinamento do TimeLinesOverlay:**
   - Substituir a etiqueta vermelha maciça "EXPIRACIÓN 00:13" por container escuro elegante (`rgba(15, 20, 28, 0.92)`) com borda e texto em `#E5484D`.
   - Reduzir o tamanho da bandeirinha de expiração no eixo temporal para proporção sutil (14px).
5. **Eliminação de Linhas Tracejadas Órfãs:**
   - Assegurar que linhas horizontais no gráfico correspondam estritamente à cotação viva ou a strikes de ordens ativas com `OrderFlagsOverlay`. Nenhuma linha residual (como a antiga 494.9696) permanecerá no canvas.
6. **Nome Comercial Amigável do Ativo:**
   - Em `TerminalHeader.tsx`, exibir "Vol 50" em vez de "SYNTH_VOL_50", mantendo o código técnico acessível apenas no popover informativo ou tooltip.

---

## 2. Passo a Passo de Execução

- **Passo 3.1:** Editar `PriceChart.tsx` para remover `title` da linha de preço atual e garantir precisão correta na escala.
- **Passo 3.2:** Ajustar `ChartDrawingToolbar.tsx` para posicionamento em `bottom: 20px, left: 16px`.
- **Passo 3.3:** Refatorar `TradersMoodBar.tsx` para eliminar corte de texto e remover tags com fundos pesados.
- **Passo 3.4:** Refatorar `TimeLinesOverlay.tsx` para usar fundo escuro translúcido na etiqueta de expiração.
- **Passo 3.5:** Ajustar `TerminalHeader.tsx` para exibir títulos comerciais amigáveis para índices sintéticos.

---

## 3. Protocolo de Testes e Validação

### Testes de Estresse e Desempenho
- **STRESS-03 (60 FPS Overlay Sync):** Simular fluxo de ticks de 50ms mantendo sincronização de coordenadas do `TimeLinesOverlay` e `TradersMoodBar` sem jitter nem vazamento de memória.
- **STRESS-04 (Multi-resolution Geometry):** Validar posições absolutas em resoluções de 1280x720, 1920x1080 e 2560x1440 sem sobreposição de elementos.

### Testes de Caos
- **CHAOS-02 (Canvas Resize Jitter):** Disparar 100 eventos sucessivos de `window.resize` e verificar que a barra de ferramentas permanece firmemente ancorada no canto inferior esquerdo e o gráfico se redimensiona suavemente.

---

## 4. Critérios de Aceite para Fechamento da Subetapa

- [ ] Apenas uma etiqueta de preço visível no eixo da cotação.
- [ ] Barra de ferramentas posicionada no canto inferior esquerdo, sem encavalar na TradersMoodBar.
- [ ] TradersMoodBar exibe rótulos completos ("SUBE XX%", "BAJA YY%") sem corte.
- [ ] Etiqueta de expiração com fundo escuro elegante e texto `#E5484D`.
- [ ] Nome do ativo exibido como "Vol 50".
- [ ] Novo arquivo de teste unitário `apps/web/src/chart/subetapa-18-03-grafico-overlays.unit.test.tsx` com 100% de aprovação.
