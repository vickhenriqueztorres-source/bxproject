# Subetapa 01 — Tokens de Precisão e Física de Movimento

> **Filosofia:** Sistema antes de tela. A física de movimento é baseada em instrumentação mecânica de precisão, não em elasticidade decorativa.

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `apps/web/src/styles/tokens-precision.css` (Criação de tokens CSS e regras de movimento)
- `apps/web/src/index.css` ou `apps/web/src/main.tsx` (Inclusão segura dos tokens)
- `apps/web/src/lib/design-tokens.ts` (Constantes tipadas para uso em componentes e testes)
- `apps/web/src/styles/tokens-precision.unit.test.ts` (Bateria de testes unitários e de invariantes)

### Arquivos Proibidos:
- Qualquer alteração em APIs de backend, migrations ou rotas do servidor.

---

## 2. Passo a Passo de Implementação

1. **Definição de Tokens CSS (`tokens-precision.css`)**:
   - Registrar as 3 superfícies de profundidade:
     `--bm-surface-bg: #0B0E14;` (fundo principal)
     `--bm-surface-panel: #121721;` (painéis e cartões)
     `--bm-surface-field: #1A202C;` (campos, inputs e dropzones)
   - Registrar as cores semânticas puras:
     `--bm-color-gain: #00E599;` (Verde Ganancia / ação principal)
     `--bm-color-loss: #FF3B56;` (Rojo Baja / perda)
     `--bm-color-pending: #FFAA00;` (Âmbar / pendente)
     `--bm-color-system: #2E86DE;` (Azul / informação)
     `--bm-color-text-primary: #F0F4F8;` (Branco / texto)
     `--bm-color-text-secondary: #8A92A1;` (Aço / apoio)
   - Registrar a Física de Movimento:
     `--bm-ease: cubic-bezier(0.16, 1, 0.3, 1);`
     `--bm-t-micro: 100ms;`
     `--bm-t-base: 180ms;`
     `--bm-t-enter: 260ms;`
     `--bm-t-count: 500ms;`
     `--bm-dist-max: 64px;`
   - Suporte nativo a `prefers-reduced-motion: reduce`:
     Todas as transições colapsam para `opacity` instantânea (0ms ou 50ms).

2. **Tipagem e Helpers TypeScript (`design-tokens.ts`)**:
   - Exportar constantes tipadas correspondentes para uso limpo no React e em estilos inline.

3. **Garantias Anti-Cassino**:
   - Proibição de regras CSS que contenham `bounce`, `keyframes shake`, `@keyframes rainbow` ou neons de alto brilho.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários
- Validar existência e valor exato dos 8 tokens de física de movimento.
- Validar que a curva `--bm-ease` é exatamente `cubic-bezier(0.16, 1, 0.3, 1)`.
- Validar a proporção e ordenação de luminescência das 3 superfícies (bg < panel < field).

### 3.2 Testes de Estresse
- Renderizar 1.000 nós no DOM aplicando as transições de `--bm-t-micro` e `--bm-t-base` simultaneamente, garantindo zero degradação de frame rate e sem travamentos de GPU.

### 3.3 Testes de Caos
- Ativação dinâmica da flag de acessibilidade `prefers-reduced-motion` e validação de descarte de transições pesadas.

### 3.4 Testes de Segurança
- Garantir que nenhum token manipule estados financeiros ou lógica de cálculo de saldos.

---

## 4. Critério de Aceite da Subetapa 01
- Suíte `tokens-precision.unit.test.ts` 100% verde no Vitest.
- Auditoria do `designer-senior` aprovada.
