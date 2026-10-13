# Subetapa 01: Unificação do Canvas e Eliminação de Paredes Artificiais (`AuthShell.tsx`)

**Responsável:** `chief-visual-director` (design) + `surgical-frontend-agent` (código)  
**Validação:** `qa-resilience-agent`  
**Status:** PRONTO PARA EXECUÇÃO  

---

## 1. Objetivo Técnico e Visual

Eliminar o "bloco retangular colado" exibido na captura do usuário (`media_1791682864191_00b1d6f8.png`), tornando a coluna esquerda `.auth-left-panel` totalmente transparente e sem bordas duras verticais (`borderRight: 'none'`). O conteúdo textual, o gráfico `Vol 50` e os selos de credibilidade passam a flutuar organicamente sobre o grid e as ondas de trading, unificando a tela inteira em um canvas cinematográfico único.

---

## 2. Passo a Passo de Implementação Cirúrgica

1. **Editar `apps/web/src/components/auth/AuthShell.tsx`**:
   - No elemento `<header data-testid="auth-header">`:
     - Trocar `backgroundColor: 'rgba(16, 22, 34, 0.85)'` por `rgba(7, 10, 15, 0.55)` com `backdropFilter: 'blur(16px)'`.
     - Suavizar a linha inferior de `1px solid ${PRECISION_SURFACES.line}` para `1px solid rgba(255, 255, 255, 0.05)`.
   - No container da split screen (`<div style={{ flex: 1, display: 'flex', ... }}>`):
     - Manter o alinhamento centralizado sem criar fundos escuros intermediários.
   - Na coluna esquerda (`<div className="auth-left-panel" ...>`):
     - Trocar `backgroundColor: 'rgba(7, 13, 24, 0.72)'` e `backdropFilter: 'blur(10px)'` por `backgroundColor: 'transparent'` e `backdropFilter: 'none'`.
     - Remover o corte vertical rígido: trocar `borderRight: 1px solid ${PRECISION_SURFACES.line}` por `borderRight: 'none'`.
   - Garantir que a coluna direita permaneça com `backgroundColor: 'transparent'`, e o card `.bm-card-fintech` continue flutuando com sua sombra natural e sólida.

---

## 3. Critérios de Aceite e Testes Rigorosos

- **Teste Estrutural:** A coluna `.auth-left-panel` não possui mais cor de fundo sólida ou borda vertical que recorte o fundo.
- **Teste de Conteúdo:** O título institucional, o mini-gráfico `Vol 50` e os 3 selos de auditoria/garantia continuam sendo renderizados com 100% de integridade e legibilidade.
- **Teste de Estresse SSR:** 100 ciclos de renderização SSR de `AuthShell` em menos de 500ms.
- **Teste de Segurança:** O layout não interfere em nenhum evento de teclado, navegação ou foco nos formulários.
