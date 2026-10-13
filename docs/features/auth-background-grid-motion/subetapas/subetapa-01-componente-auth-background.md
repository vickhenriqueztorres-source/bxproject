# Subetapa 01 — Criação do Componente AuthBackgroundGridMotion

> **Objetivo:** Construir o componente `AuthBackgroundGridMotion.tsx` contendo o padrão de grid cartesiano SVG de 48px, o gradiente radial ambiente aveludado e as curvas vetoriais contínuas de trading em SVG, encapsulado com `pointer-events: none` e `position: absolute`.

---

## 1. Escopo de Arquivos
- `apps/web/src/components/auth/AuthBackgroundGridMotion.tsx` (Componente visual de background)
- `apps/web/src/components/auth/auth-background.unit.test.tsx` (Bateria de testes unitários)

---

## 2. Detalhes de Implementação
- **Grid Cartesiano**:
  - Elemento `<svg>` de dimensões `100% x 100%`.
  - `<defs><pattern id="bm-auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">` com linhas de `1px` em `rgba(255, 255, 255, 0.035)`.
- **Glow Ambiente de Fundo**:
  - Gradiente radial esmeralda difuso com `ellipse at 70% 30%` em `rgba(34, 196, 122, 0.065)` decaindo para transparente.
- **Curvas Vetoriais de Tendência**:
  - Dois paths de curvas de Bézier cúbicas suaves subindo em diagonal ascendente:
    1. Curva primária com traço `#22C47A` de 2px e preenchimento vertical semi-transparente.
    2. Curva secundária com traço `#10D078` de 1.5px e opacidade de 40%.
- **Zero interferência**:
  - `position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;`.

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] O componente renderiza o grid SVG e as curvas com os IDs e atributos esperados.
- [ ] Atributo `pointer-events: none` garantido para não interceptar cliques no formulário.
