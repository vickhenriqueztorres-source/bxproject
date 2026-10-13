# Subetapa 04 — Bateria de Testes Vitest (Estresse SSR, Caos, Performance e Segurança)

> **Objetivo:** Submeter a nova camada de fundo com grid e motion a testes automatizados com Vitest, avaliando o tempo de renderização síncrona em 100 ciclos, ausência de vazamento de memória e estabilidade.

---

## 1. Escopo de Arquivos
- `apps/web/src/pages/auth-background-grid-motion.unit.test.tsx`
- Suíte completa de autenticação e páginas.

---

## 2. Baterias
1. **Estresse**:
   - 100 ciclos de renderização do `AuthBackgroundGridMotion` em menos de 250ms.
   - 100 ciclos de renderização do `AuthShell` com background ativo em menos de 500ms.
2. **Caos e Resiliência**:
   - Renderização com diferentes viewports (mobile, tablet, desktop wide) sem quebras do SVG.
3. **Segurança**:
   - SVG livre de atributos maliciosos como `<script>`, `onload` ou `xlink:href` externo.

---

## 3. Critérios de Aceite
- 100% dos testes aprovados no Vitest.
