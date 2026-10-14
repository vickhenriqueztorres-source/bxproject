# Plano Cirúrgico de Diagnóstico, Blindagem e Certificação Contra Colapso de Dimensão Zero (Issues #1334 / #1344)

**Agente Líder:** `chart-trading-engineer`  
**Agente Executor:** `surgical-frontend-agent` (`cirurgiao`)  
**Guardião de Regressão & QA:** `regression-guardian-agent` / `qa-resilience-agent`  
**Skills Ativadas:** `11-chart-trading-tools`, `17-mudanca-cirurgica`, `06-testing-quality`

---

## 1. Diagnóstico Forense do Código Atual (Causa Raiz de Container 0x0)

Auditamos toda a cadeia de containers DOM e regras CSS desde o shell principal (`styles.css` / `TerminalLayout.tsx`) passando por `MultiChartGrid.tsx`, `ChartSandbox.tsx`, `PriceChart.tsx`, `IsolatedChartHost.tsx` e `TradingViewCanvas.tsx` contra o defeito documentado nas **Issues #1334 e #1344 do TradingView Lightweight Charts**:

> *"O `div` do gráfico colapsa pra `height: 0` (ou `width: 0`) porque o pai mudou de layout — o gráfico existe, mas não aparece. Não dá erro no console. A parent's CSS (flex/grid, overflow, transforms) can collapse the chart container."*

### 🚨 Os 4 Vetores de Colapso de Dimensão Zero Encontrados

| ID | Arquivo | Linhas | Causa Raiz Técnica Encontrada | Efeito no Navegador |
| :--- | :--- | :--- | :--- | :--- |
| **ZD-01** | `TradingViewCanvas.tsx` | 24–26, 87–95 | Passa `clientWidth` e `clientHeight` crus para `createChart()` e `applyOptions()` no `ResizeObserver` sem validar se são `> 50px` e sem `minHeight`/`minWidth` defensivo no container. | Se o pai sofrer qualquer reflow transitório para `0x0`, o canvas aplica `width: 0, height: 0` e desaparece silenciosamente sem erro no console. |
| **ZD-02** | `ChartSandbox.tsx` | 57–66 | Usa `contain: 'layout size'` sem `flex: 1`. Pela especificação W3C CSS Containment, `contain: size` exige que o container receba `flex: 1` e que seu pai flex tenha `height: '100%', minHeight: 0` explícitos para nunca colapsar para `0x0`. | Colapso silencioso para `height: 0` em transições de layout Flex/Grid se o pai for flex container. |
| **ZD-03** | `MultiChartGrid.tsx` | 235–236, 429 | Na linha 429, o container `.multi-chart-grid` usa `height: '100%'` sem `flex: 1, minHeight: 0, minWidth: 0`. Na linha 236, o wrapper imediato do `ChartSandbox` usa `flex: 1, minWidth: 0`, mas não define `height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column'`. | Quando `.terminal-body` alterna para `flex-direction: column` (ex: telas `< 768px` ou split-screen), `height: 100%` perde a referência percentual e colapsa a célula do gráfico para `0px`. |
| **ZD-04** | `IsolatedChartHost.tsx` | 112–113, 204–212 | Se no instante do mount `clientWidth`/`clientHeight` forem `0` (layout ainda não pintado), não consulta `getBoundingClientRect()` e não agenda leitura de recuperação via `requestAnimationFrame` para ajustar assim que o container ganhar dimensão real. | Em mounts com container inicialmente `0x0`, o gráfico pode ficar desalinhado da célula real caso o `ResizeObserver` inicial dispare antes do layout estabilizar. |

---

## 2. Plano de Correção Cirúrgica (Orçamento Estrito, Zero Regressão)

Seguindo a skill `17-mudanca-cirurgica` (máximo de 5 arquivos e 150 linhas alteradas, sem mudar assinaturas públicas e preservando 100% os invariantes dos testes existentes `SB-01` e `PCD-02`):

### Passo 1: Blindagem da Cadeia Flex/Grid em `MultiChartGrid.tsx` e `ChartSandbox.tsx` (ZD-02 e ZD-03)
1. Em `ChartSandbox.tsx`:
   - Adicionar `flex: 1` mantendo `contain: 'layout size'`, `minHeight: 0`, `minWidth: 0`, `width: '100%'`, `height: '100%'` (preservando o invariante `SB-01` em `chart-sandbox.unit.test.tsx`).
2. Em `MultiChartGrid.tsx`:
   - Na linha 236 (wrapper da área do canvas dentro de `GridCell`), adicionar `height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column'`.
   - Na linha 429 (container raiz `multi-chart-grid`), adicionar `flex: 1, minHeight: 0, minWidth: 0`.

### Passo 2: Blindagem de Dimensões Reais e Auto-Heal Geométrico em `IsolatedChartHost.tsx` (ZD-04)
1. Criar leitura defensiva de dimensões no mount que consulta `clientWidth`/`clientHeight` com fallback para `getBoundingClientRect()` e aplica piso seguro (`width >= 320`, `height >= 300`), mantendo `minHeight: '350px'` no style default (preservando o invariante `PCD-02` em `pricechart-decoupling.unit.test.tsx`).
2. No `ResizeObserver`, ler `entry.contentRect` com fallback para `hostEl.clientWidth`/`clientHeight` e ignorar estritamente colapsos `<= 50px`.
3. Se no instante do mount o container ainda estava `0x0` (`rawW <= 50 || rawH <= 50`), agendar verificação via `requestAnimationFrame` (limpa no unmount com `cancelAnimationFrame`) para ressincronizar `chart.applyOptions({ width, height })` assim que o layout estabilizar.

### Passo 3: Blindagem Contra Dimensão Zero em `TradingViewCanvas.tsx` (ZD-01)
1. Aplicar piso mínimo `Math.max(clientWidth || 800, 320)` e `Math.max(clientHeight || 500, 300)` no `createChart`.
2. No `handleResize` do `ResizeObserver`, ler `entry.contentRect` / `clientWidth` e bloquear dimensões colapsadas (`if (w > 50 && h > 50)`) antes de chamar `chartRef.current.applyOptions({ width: w, height: h })`, além de garantir `minWidth: '320px', minHeight: '300px'` no container.

---

## 3. Bateria de Testes de Certificação Anti-Dimensão Zero

Criaremos a suíte `tests/unit/chart-zero-dimension-guard.test.ts` validando:
1. **ZD-TEST-01 (`IsolatedChartHost` — Mount Inicial em Container `0x0` + Auto-Heal via ResizeObserver/rAF):**
   - Monta `IsolatedChartHost` quando o `div` pai está temporariamente com `clientWidth = 0, clientHeight = 0`.
   - Verifica que `createChart` nunca recebe `width: 0` ou `height: 0`.
   - Simula colapso de Flexbox (`ResizeObserver` emitindo `0x0`, `0x500`, `400x0`, `30x30`) e prova que `chart.applyOptions` **nunca é chamado com dimensões $\le 50\text{px}$**.
   - Simula estabilização do container via `requestAnimationFrame` e `ResizeObserver` para `640x360` e comprova que `chart.applyOptions({ width: 640, height: 360 })` e `onDimensionsChange` atualizam imediatamente.
2. **ZD-TEST-02 (`ChartSandbox` & `MultiChartGrid` — Invariantes CSS Flex/Grid Anti-Colapso):**
   - Verifica que `ChartSandbox` mantém `flex: 1, width: 100%, height: 100%, min-height: 0, contain: layout size`.
   - Verifica que `MultiChartGrid` preserva `flex: 1, minHeight: 0, minWidth: 0` em toda a cadeia até a célula.
3. **ZD-TEST-03 (`TradingViewCanvas` — Imunidade a Colapso `0x0` no Mount e no Resize):**
   - Monta `TradingViewCanvas` com container `0x0`, verifica piso positivo no `createChart`, dispara `ResizeObserver` com `0x0` (ignorado) e depois `900x450` (aplicado).
