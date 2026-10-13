# Subetapa 01 — Tokens CSS de Cápsulas, Inputs 12px/48px e Fundo Aveludado

> **Objetivo:** Estabelecer as classes e variáveis de estilo para a nova identidade visual: cantos arredondados de 12px para inputs, 20px para cards, 9999px para botões/pílulas, paleta profunda aveludada `#080B11` / `#0E131F` / `#121824`, e anel de foco refinado.

---

## 1. Escopo de Arquivos
- `apps/web/src/styles/tokens-precision.css`
- `apps/web/src/lib/design-tokens.ts`
- `apps/web/src/pages/subetapa-pill-01-tokens.unit.test.tsx`

---

## 2. Implementação
1. Adicionar classes utilitárias no CSS:
   - `.bm-pill-container`: `border-radius: 9999px`, fundo `#0E131F`, borda `1px solid rgba(255,255,255,0.08)`.
   - `.bm-pill-active`: `border-radius: 9999px`, fundo `#141A28`, borda `1px solid rgba(255,255,255,0.14)`.
   - `.bm-card-fintech`: `border-radius: 20px`, fundo `#0B0F17`, borda `1px solid rgba(255,255,255,0.07)`, sombra `0 24px 64px rgba(0,0,0,0.6)`.
   - `.bm-input-fintech`: `height: 48px`, `border-radius: 12px`, fundo `#121824`, borda `1px solid rgba(255,255,255,0.08)`, padding `0 16px`, cor `#F4F5F7`, fonte Geist Sans 14px.
   - `.bm-btn-pill-primary`: `height: 48px`, `border-radius: 9999px`, fundo `#22C47A`, cor `#08140B`, peso 700, transição de 100ms.
   - `.bm-security-badge`: tipografia discreta, ícone de cadeado verde de segurança.

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Teste unitário verificando a presença e os valores das classes de estilo de pílula e input 12px.
- [ ] 100 ciclos de renderização SSR sem regressão.
