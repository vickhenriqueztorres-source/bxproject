# Subetapa 02 — AuthTabSwitcher em Cápsula (Pill Shape)

> **Objetivo:** Refatorar o `AuthTabSwitcher.tsx` para reproduzir exatamente o layout das imagens: cápsula externa de 9999px de raio com as abas `[Criar conta]` e `[Entrar]`, onde a aba ativa é uma cápsula escura elevada com borda sutil e a inativa é texto cinza elegante.

---

## 1. Escopo de Arquivos
- `apps/web/src/components/auth/AuthTabSwitcher.tsx`
- `apps/web/src/components/auth/auth-tab-switcher.unit.test.tsx`

---

## 2. Detalhes de Implementação
- Cápsula container:
  - `height: 44px`
  - `border-radius: 9999px`
  - `background: #0E131F`
  - `border: 1px solid rgba(255, 255, 255, 0.08)`
  - `padding: 4px`
  - `display: flex`, `gap: 4px`
- Botão da Aba Ativa:
  - `height: 36px`
  - `border-radius: 9999px`
  - `background: #141A28`
  - `border: 1px solid rgba(255, 255, 255, 0.14)`
  - `color: #FFFFFF`
  - `font-weight: 700`
  - `font-size: 13.5px`
  - `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4)`
- Botão da Aba Inativa:
  - `color: #8A92A1`
  - `font-weight: 500`
  - `background: transparent`
  - `border: 1px solid transparent`
  - Hover: cor do texto clareia para `#C0C7D5`

---

## 3. Matriz de Testes & Critérios de Aceite
- [ ] Teste unitário confirmando `border-radius: 9999px` (estilo pill).
- [ ] Teste de acessibilidade ARIA mantido (`role="tablist"`, `role="tab"`).
- [ ] Teste de 500 alternâncias consecutivas em menos de 100ms.
