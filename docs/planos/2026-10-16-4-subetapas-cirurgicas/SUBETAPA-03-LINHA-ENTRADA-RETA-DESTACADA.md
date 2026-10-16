# Subetapa 03 — Linha de Ponto de Entrada Reta (Sólida) e Altamente Destacada (Imagem 2)

**Agentes Alocados**: `chart-trading-engineer`, `chief-visual-director`, `surgical-frontend-agent`, `qa-resilience-agent`  
**Skills Ativadas**: `11-chart-trading-tools`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`  
**Status**: Planejada — Execução após validação 100% da Subetapa 02

---

## 1. Diagnóstico Preciso da Causa Raiz (Imagem 2)

1. **Linha de Entrada Pontilhada e com Baixo Contraste em `OrderFlagsOverlay.tsx`**:
   - Em [`OrderFlagsOverlay.tsx:189-201`](file:///d:/brokerproject/apps/web/src/chart/OrderFlagsOverlay.tsx#L189-L201) (caminho ativo `TRADEROOM_POLISH = true`, visível na Imagem 2 com a pílula `▲ 8 · $212 @987.1393 00:44`):
     ```tsx
     <line
       key={`strike-line-${g.key}`}
       x1={0}
       y1={lineYs[i]}
       x2={lineEndX}
       y2={lineYs[i]}
       stroke={stateColor(g)}
       strokeOpacity={0.7}
       strokeWidth={1}
       strokeDasharray="4 4"
     />
     ```
   - E em [`OrderFlagsOverlay.tsx:348-356`](file:///d:/brokerproject/apps/web/src/chart/OrderFlagsOverlay.tsx#L348-L356) (caminho clássico `polish = false`):
     ```tsx
     <line
       x1={0}
       y1={topY}
       x2={lineEndX}
       y2={topY}
       stroke={baseColor}
       strokeWidth={1.5}
       strokeDasharray="4 4"
     />
     ```
2. **Impacto Visual**:
   - O atributo `strokeDasharray="4 4"` deixa a linha pontilhada/tracejada.
   - Combinado com `strokeWidth={1}` e `strokeOpacity={0.7}`, a linha de ponto de entrada desaparece visualmente sobre as velas e sobre o grid escuro, dificultando a leitura imediata de onde a operação foi aberta.

---

## 2. Passo a Passo Cirúrgico da Implementação

### Passo 3.1 — Linha Reta Sólida (`solid`) e Destacada em `OrderFlagsOverlay.tsx`
- No caminho principal (`polish = true`, linhas 189-205 de `OrderFlagsOverlay.tsx`):
  - Remover `strokeDasharray="4 4"` da `<line key={`strike-line-${g.key}`} ... />` para que seja uma **linha reta contínua (100% sólida)**.
  - Elevar `strokeWidth` de `1` para `2` (`strokeWidth={2}`) e `strokeOpacity` de `0.7` para `0.95` (`strokeOpacity={0.95}`), garantindo presença visual imediata e leitura limpa de instrumento de precisão (sem neon/blur proibido, respeitando 100% os tokens `var(--profit)` / `var(--loss)`).
  - Adicionar um ponto de ancoragem nítido (`<circle data-testid={`strike-entry-dot-${g.key}`} cx={lineEndX} cy={lineYs[i]} r={3.5} fill={stateColor(g)} />`) na conexão entre a linha reta e a pílula da posição, reforçando o destaque do nível exato de strike.
  - Na linha conectora diagonal (`connector-${g.key}`, quando múltiplas etiquetas são afastadas por anticolisão), também usar traço contínuo limpo (`strokeWidth={1.5}`, `strokeOpacity={0.85}`, sem `strokeDasharray`).
- No caminho clássico (`polish = false`, linhas 348-356 de `OrderFlagsOverlay.tsx`):
  - Remover `strokeDasharray="4 4"` e elevar `strokeWidth={2}` para manter consistência total caso a flag clássica seja usada.

### Passo 3.2 — Atualização Alinhada dos Testes Existentes de Strike Line
- Atualizar `apps/web/src/chart/subetapa-polish-04-positions.unit.test.tsx` (teste `"linhas de entrada sólidas e destacadas: 2px, retas contínuas, sem tracejado"`) e seu snapshot de flag desligada, além de `apps/web/src/chart/subetapa-7-2-strike-lines-svg.unit.test.tsx`, para refletir a nova regra de negócio solicitada pelo usuário (`not.toContain('stroke-dasharray')`, `stroke-width="2"`).

---

## 3. Plano de Testes (Unitários, Estresse, Segurança e Caos)

Arquivo de teste dedicado: `apps/web/src/chart/subetapa-03-solid-highlighted-entry-line.unit.test.tsx`

1. **Teste Unitário 3.1 (Linha Reta Sólida sem `stroke-dasharray` e com Destaque `stroke-width="2"`)**:
   - Comprova que para contratos `UP` e `DOWN` (ganhando e perdendo), o SVG `order-strike-lines-svg` renderiza `<line>` sem `stroke-dasharray`, com `stroke-width="2"` e `stroke-opacity="0.95"`, além do marcador `strike-entry-dot-*`.
2. **Teste Unitário 3.2 (Conformidade Anti-Cassino & Tokens Semânticos)**:
   - Verifica que o destaque da linha usa exclusivamente tokens de precisão (`var(--profit)`, `var(--loss)`) sem introduzir `backdrop-filter` ou glows proibidos.
3. **Teste de Caos 3.3 (Coordenadas Extremas, Contratos Sobrepostos no Mesmo Milissegundo e Preço Null)**:
   - Testa múltiplos contratos no mesmo preço exato e em preços distantes de 1px, garantindo que a linha sólida permanece cravada na coordenada `Y` real do strike enquanto as etiquetas respeitam a anticolisão (`>= 18px`).
4. **Teste de Segurança 3.4 (Escape de Atributos SVG contra XSS)**:
   - Injeta IDs e símbolos contendo caracteres especiais/vetores XSS e comprova que nenhuma tag ou atributo indevido é injetado no SVG.
5. **Teste de Estresse 3.5 (250 Contratos Abertos Renderizados com Linhas Sólidas em `< 50ms`)**:
   - Mede a performance de renderização de 250 contratos simultâneos garantindo tempo `< 50ms`.
