# Subetapa 03 — Integração Cirúrgica no AuthShell (Zero Deslocamento de Layout)

> **Objetivo:** Inserir o componente `AuthBackgroundGridMotion` na base do `AuthShell.tsx`, garantindo que todo o conteúdo existente (Header institucional, textos, gráfico Vol 50 e card de formulário) permaneça exatamente na mesma posição física em tela, sem alterar margens, paddings ou coordenadas.

---

## 1. Escopo de Arquivos
- `apps/web/src/components/auth/AuthShell.tsx`

---

## 2. Detalhes de Implementação
- No `AuthShell.tsx`:
  - Adicionar `position: 'relative', overflow: 'hidden'` no container principal.
  - Inserir `<AuthBackgroundGridMotion />` como primeiro filho, com `z-index: 0`.
  - Garantir que o Header, a coluna esquerda e o formulário permaneçam em camada superior com `position: 'relative', zIndex: 1`.
  - Manter os fundos ligeiramente translúcidos com backdrop sutil para deixar o grid e o movimento visíveis de forma elegante sob as superfícies.

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Confirmação de que o `AuthShell` renderiza o `AuthBackgroundGridMotion`.
- [ ] Coordenadas e layout dos filhos mantidos intactos.
