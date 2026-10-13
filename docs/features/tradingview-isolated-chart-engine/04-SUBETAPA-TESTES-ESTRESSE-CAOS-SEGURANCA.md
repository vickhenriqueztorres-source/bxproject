# Subetapa 04: Bateria de Testes de Estresse, Caos, Segurança e Regressão

**Feature**: `FEAT-CHART-ISOLATION-01`  
**Responsável**: `qa-resilience-agent`  
**Revisor**: `regression-guardian-agent` & `financial-correctness-reviewer`  
**Status**: PLANEJADO

---

## 1. Objetivo Técnico

Submeter a nova arquitetura ilhada do TradingView Lightweight Charts a uma bateria exaustiva e impiedosa de testes automatizados, cobrindo:
1. **Estresse Operacional**: Alta frequência de ticks (1.000 ticks/s), alternância veloz de ativos e grande volume histórico de barras;
2. **Caos e Falhas**: Colapso de dimensões do container (0x0px), interrupção abrupta de rede, corrupção de storage local e timestamps desordenados;
3. **Segurança e Sanitização**: Sanitização contra injeção de scripts (XSS) em labels de cotação e proteção contra dados numéricos degenerados (`NaN`, `Infinity`, `null`);
4. **Regressão Global**: Garantia inegociável de que todos os 205 testes pré-existentes em `apps/web` permanecem 100% verdes.

---

## 2. Bateria de Testes Detalhada

### 2.1. Matriz de Estresse (`chart-isolation-stress.unit.test.ts`)

| ID | Cenário | Carga / Condição | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **STR-01** | **Rajada de Ticks 1.000/s** | 1.000 ticks injetados em 1 segundo via WebSocket mock | Máximo 60 renders agendados no rAF; zero travamento de CPU (>50ms). |
| **STR-02** | **Janela Macro 3.500 Velas** | 3.500 velas carregadas no `setData` | Tempo de carga < 40ms; memória estável sem leaks de closures. |
| **STR-03** | **Carga de 50 Desenhos Vetoriais** | 50 linhas de Fibonacci e tendências desenhadas no overlay | Redraw síncrono no pan/zoom mantido a 60 FPS. |
| **STR-04** | **Comutação Veloz de 100 Ativos** | 100 trocas consecutivas de símbolo em loop rápido | Zero instâncias fantasmas de gráficos deixadas na memória (`chart.remove()` garantido). |

---

### 2.2. Matriz de Caos (`chart-isolation-chaos.unit.test.ts`)

| ID | Cenário | Ação de Caos | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **CHS-01** | **Colapso de Dimensões (0x0px)** | `ResizeObserver` reporta largura e altura zero por 500ms | O gráfico ignora o resize inválido e não lança exceções no canvas. |
| **CHS-02** | **Queda e Retomada de Conexão** | Desconexão súbita com perda de 30 segundos de ticks | Transição suave para fallback sem tela preta nem congelamento. |
| **CHS-03** | **Ticks com Timestamp Invertido** | Envio de `t_n < t_{n-1}` ou sequências fora de ordem | Descarte atômico e silencioso pelo motor de validação temporal. |
| **CHS-04** | **Corrupção de LocalStorage** | `broker_drawings_XYZ` preenchido com string arbitrária malformada | Fallback gracioso para array vazio `[]` sem crash de inicialização. |

---

### 2.3. Matriz de Segurança e Sanitização (`chart-isolation-security.unit.test.ts`)

| ID | Cenário | Vetor de Teste | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **SEC-01** | **Anti-XSS em Tags de Preço** | Cotação com payload `<script>alert(1)</script>` | Escape estrito e sanitização antes de renderizar em canvas/SVG. |
| **SEC-02** | **Preços Degenerados** | Ticks com `NaN`, `+Infinity`, `-Infinity`, `-100.0` | Rejeição atômica pelo `RafChartUpdater` sem mutação do gráfico. |
| **SEC-03** | **Sanitização de Símbolos** | URLs com caracteres especiais `?symbol=../../etc/passwd` | Rejeição e fallback automático para ativo padrão `SYNTH_VOL_50`. |

---

### 2.4. Matriz de Regressão Global

Execução obrigatória do comando de homologação completa:
```bash
npx vitest run apps/web
```
**Meta**: 34+ arquivos de teste aprovados, 0 falhas, 100% de conformidade com os tokens Binmax e as regras financeiras.

---

## 3. Critério de Homologação Final da Subetapa 04

- [ ] Todas as 4 matrizes de teste (Estresse, Caos, Segurança e Regressão) implementadas e executadas.
- [ ] Relatório final de homologação emitido pelo `qa-resilience-agent` e aprovado pelo `tech-lead-orchestrator`.
- [ ] Zero quebras visuais e zero erros no console do navegador.
