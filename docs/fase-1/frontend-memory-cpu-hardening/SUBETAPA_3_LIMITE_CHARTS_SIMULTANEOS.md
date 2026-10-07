# Subetapa 3 — Limite Rígido de Gráficos Simultâneos (Max 6) & Alerta Visual

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_3_LIMITE_CHARTS_SIMULTANEOS.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** Estabilidade de Renderização, Prevenção de Crash da GPU

---

## 1. Objetivo Técnico

Navegadores modernos impõem restrições severas à alocação de contextos gráficos (Canvas 2D / WebGL) por documento. Quando um aplicativo web tenta manter mais de 6-8 gráficos de alta frequência simultaneamente, a carga de rasterização consome mais de 80% da CPU e a perda de contexto (*context lost*) pode derrubar a página inteira.

Para garantir estabilidade institucional contínua:
1. Definir uma constante institucional rígida:
   ```typescript
   export const MAX_CHARTS = 6;
   ```
2. Adicionar na grade suporte formal aos layouts: `1x1` (1), `2x1` (2), `2x2` (4) e `3x2` (6).
3. Qualquer tentativa de configurar ou instanciar um número superior a 6 gráficos deve ser interceptada imediatamente, com exibição de banner visual ou aviso não-intrusivo para o usuário:
   *"Limite máximo de 6 gráficos simultâneos atingido para preservar a estabilidade da plataforma."*

---

## 2. Passos de Execução

1. **Passo 3.1:** Exportar `MAX_CHARTS = 6` em `MultiChartGrid.tsx`.
2. **Passo 3.2:** Expandir as opções de grade com suporte a layout de 6 gráficos (`3x2`), permitindo monitorar até 6 ativos simultaneamente sem perda de performance.
3. **Passo 3.3:** Implementar trava algorítmica: se uma solicitação tentar abrir ou definir mais de 6 células, o array é truncado em `MAX_CHARTS` e o estado `warningMaxCharts` é ativado com auto-dismiss em 4 segundos.
4. **Passo 3.4:** Adicionar indicador visual elegante no topo da barra de ferramentas da grade quando o limite máximo de 6 gráficos estiver em uso.
5. **Passo 3.5:** Criar teste automatizado `tests/test-subetapa-3-fe-max-charts-limit.mjs` testando tentativas de abertura de 7, 8 e 10 gráficos e comprovando o corte em 6.
6. **Passo 3.6:** Homologar o Quality Gate da Subetapa 3.

---

## 3. Critérios de Aceite

- [x] O número de gráficos renderizados simultaneamente na tela é matematicamente $\le 6$.
- [x] Layouts suportados cobrem 1, 2, 4 e 6 gráficos.
- [x] Tentativa de ultrapassar 6 gráficos aciona feedback informativo e preserva os 6 existentes.
- [x] Zero mensagens de erro de "Too many active WebGL/Canvas contexts".
