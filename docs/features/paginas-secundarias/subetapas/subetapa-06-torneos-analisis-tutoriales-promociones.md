# Subetapa 06: Módulos de Engajamento — Torneos, Análisis, Tutoriales & Promociones

**Responsáveis:** `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_27-1.png` (Torneos `/torneos` e detalhes com ranking)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_28-2.png` (Análisis `/analisis` com métricas e gráficos)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_29-3.png` (Tutoriales `/tutoriales` com player em modal)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_30-4.png` (Promociones `/promociones`)

---

## 1. Objetivo Técnico
Entregar os quatro módulos chave de retenção e valor para o trader: a central de Torneios com ranking ao vivo, o painel de Análise quantitativa de desempenho pessoal, a plataforma de Tutoriais em vídeo com player dedicado, e a vitrine de Promoções transparente com ativação de bônus sem linguagem de cassino.

---

## 2. Requisitos Visuais e Funcionais

### 2.1 Torneos (`/torneos`)
- **Cabeçalho:** "Torneos - Compite con otros traders, demuestra tus habilidades y gana premios reales."
- **Grade Superior de Torneios:**
  - Status chips: `EN VIVO` (verde com pulso), `PRÓXIMO` (azul), `FINALIZADO` (cinza escuro).
  - Títulos: "Copa BINMAX", "Desafío de la Semana", "Maestros del Forex", "Reto Express", "Campeones del Mes".
  - Premiação total (ex: `$2,500`), número de participantes (ex: `1,248`), temporizador restante (`Termina en 02:15:30`).
  - Botão de ação: `"Participar ->"` (verde) ou `"Ver detalles"` / `"Ver ranking"`.
- **Painel Inferior do Torneio Selecionado:**
  - **Coluna 1 (Regras):** Período do torneio, Depósito não requerido (uso de conta prática), Tipo de operações, Critério de classificação (Maior rentabilidade percentual), Mínimo de 10 operações.
  - **Coluna 2 (Ranking em tempo real):** Posição do usuário fixada em destaque no topo `#1 Tú (TraderPro) +285.43%  42 ops`, seguida pela tabela de competidores com medalhas de ouro/prata/bronze e bandeiras de países.
  - **Coluna 3 (Prêmios por posição):** Lista de premiação decrescente (`1º $1,000`, `2º $500`, `3º $300`, `4º $200`, `5º $100`, `6-10º $50`, etc.).

### 2.2 Análisis (`/analisis`)
- **Seletor de Período:** Dropdown `Últimos 30 días`, `Últimos 7 días`, `Todo el historial`.
- **4 Cards de Métricas Principais no Topo:**
  1. `Tasa de acierto`: `68.2%` (+6.4% vs período anterior).
  2. `Resultado total`: `$1.230,00` (+12.8% em verde).
  3. `Racha actual`: `4` operações vencedoras (Melhor sequência: `8`).
  4. `Mejor horario`: `20:00 – 22:00` (72.5% de acerto).
- **Gráficos e Indicadores:**
  - `Resultado por día`: Gráfico de barras verticais (verde para dias positivos, vermelho para dias negativos) com alternador entre `Ganancias` e `Operaciones`.
  - `Resultado por activo`: Lista de ativos (EUR/USD, GBP/USD, USD/JPY, AUD/USD, BTC/USD, ETH/USD) com barras de progresso proporcionais à assertividade e contagem de operações.
  - `Distribución de resultados`: Donut chart interativo exibindo `68.2%` ganadoras (137 ops) vs `31.8%` perdedoras (64 ops), total de 201 operações.
  - `Mejor horario para operar`: Histograma por blocos de 2 horas (00-02 até 22-24) destacando em verde a melhor faixa.
  - `Estadísticas clave`: Tempo médio de operação (`3m 12s`), Operação mais rentável (`$320,00`), Operação menos rentável (`-$180,00`), Média por operação (`$6,12`).

### 2.3 Tutoriales (`/tutoriales`)
- Barra de pesquisa integrada: `"Buscar tutoriales..."`.
- Chips de categoria: `"Todos los tutoriales"`, `"Principiantes"`, `"Plataforma"`, `"Estrategias"`, `"Gestión de riesgo"`.
- **Tutorial Destacado:**
  - Card largo com thumbnail e botão play sobreposto.
  - Título `"Cómo hacer tu primera operación"`, badge `"Principiantes"`, duração `03:24`.
  - Botão verde `"Ver tutorial"`.
- **Player Modal Interativo:**
  - Modal com reprodução de vídeo/demo da sala, barra de progresso com scrubbing, controle de volume, fullscreen e descrição.
- **Grade de Aulas:** Cards com thumbnails e durações (`02:18`, `03:02`, `02:45`, `03:10`, `02:35`, `03:41`).

### 2.4 Promociones (`/promociones`)
- Cards profissionais com visual sóbrio (sem temas de cassino):
  1. `Bono de bienvenida`: `$10.000` virtuais para praticar sem depósito, condição de volume `$50.000`, validade de 30 dias, botão verde `"Activar ->"`.
  2. `Cashback semanal`: `10%` das operações perdedoras até `$5.000` semanais, volume de `$100.000`, botão `"Activar ->"`.
  3. `Torneo de trading`: Prêmio de `$50.000` virtuais, Top 10, período definido, botão `"Activar ->"`.
- Banner inferior com escudo de segurança: `"Promociones con condiciones claras y transparentes - Todas nuestras promociones están diseñadas para ofrecerte más valor en tu experiencia de trading, con reglas justas y sin riesgos para tu capital real."`.

---

## 3. Testes Obrigatórios da Subetapa 06
1. **Testes de Cálculo Analítico (`src/trade/analisis-metrics.unit.test.ts`):**
   - Assertividade percentual exata `(vitorias / total) * 100`.
   - Cálculo de sequências consecutivas (win streaks).
2. **Testes de Interação de Torneios:**
   - Participação e alteração de estado para "Inscrito".
   - Ordenação correta do ranking decrescente.
3. **Testes de Pesquisa e Filtros de Tutoriais:**
   - Filtragem de aulas por texto digitado e por chip de categoria.
