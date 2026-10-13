# Subetapa 02 — Física de Motion CSS a 60 FPS com Aceleração por GPU

> **Objetivo:** Adicionar as animações contínuas de ondulação das curvas vetoriais e pulso sutil da iluminação em `tokens-precision.css`, utilizando transformações aceleradas por GPU (`translate3d`), ciclo harmônico suave e conformidade estrita com `prefers-reduced-motion`.

---

## 1. Escopo de Arquivos
- `apps/web/src/styles/tokens-precision.css`

---

## 2. Detalhes de Implementação
- **Keyframes de Ondulação Vetorial (`bmWaveDrift`)**:
  - Ciclo de 12 segundos com `ease-in-out` suave e infinito.
  - Variação controlada de deslocamento vertical e horizontal (`translate3d(0, 0, 0)` -> `translate3d(-10px, 8px, 0)` -> `translate3d(6px, -6px, 0)` -> `translate3d(0, 0, 0)`).
  - Limite de translação respeita estritamente o token `--bm-dist-max: 64px`.
- **Keyframes de Pulso Luminoso (`bmGlowDrift`)**:
  - Ciclo suave de 8 segundos variando opacidade entre `0.7` e `1.0`.
- **Performance**:
  - Propriedades animadas estritas: `transform, opacity`.
  - `will-change: transform, opacity`.
- **Acessibilidade**:
  - Desativação imediata em `@media (prefers-reduced-motion: reduce)`.

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Confirmação de presença das regras `@keyframes bmWaveDrift` e `.bm-bg-curve-motion` no CSS.
- [ ] Respeito a `prefers-reduced-motion`.
