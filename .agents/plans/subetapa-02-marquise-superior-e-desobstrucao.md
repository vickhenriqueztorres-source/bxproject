# Subetapa 02: Marquise Superior Protegida & Desobstrução do Topo do Gráfico

> **Objetivo:** Isolar a telemetria das linhas de compra/expiração e pavios de velas através de uma marquise óptica acetinada com backdrop blur, e reposicionar o seletor do ativo in-chart para evitar conflito de largura.

---

## 1. Alterações Específicas em `PriceChart.tsx`
- **Marquise Superior com Proteção Óptica:**
  - Em vez de um container 100% transparente que deixa linhas e velas cortarem os números, a barra de telemetria é envolvida por uma superfície elegante com `background: rgba(11, 14, 20, 0.75)`, `backdrop-filter: blur(16px)`, `border-bottom: 1px solid rgba(244, 245, 247, 0.08)`, e `border-radius: 6px`.
  - Essa camada de proteção cria um escudo visual para que a linha tracejada branca (`time-line-purchase`) e as sombras das velas nunca fatiem o texto.
- **Desobstrução Espacial do Seletor In-Chart:**
  - Em modo de telemetria ativa, o container flex assegura folga generosa entre o seletor e a telemetria (`gap: 16px`), ou posiciona a telemetria com ancoragem fixa de modo que o seletor não empurre os 4 blocos para a zona das linhas temporais.

## 2. Teste de Validação
- **Arquivo de Teste:** `src/chart/subetapa-refine-marquise-anti-collision.unit.test.tsx`
- **Cenários a Validar:**
  - Presença de proteção óptica (`backdrop-filter: blur(16px)` e background translúcido acetinado).
  - Ausência de sobreposição física com o seletor de ativos in-chart.
  - Teste de caos/estresse de renderização sob mudanças rápidas de ticks.
