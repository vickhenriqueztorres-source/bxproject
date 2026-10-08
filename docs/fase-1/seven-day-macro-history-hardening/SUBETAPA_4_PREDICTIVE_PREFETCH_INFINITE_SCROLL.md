# Subetapa 4: Prefetch Preditivo no Infinite Scroll (Zero Spinner Ahead-of-Time)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `11-chart-trading-tools`  
**Invariantes:** V-11 (Interface Fluida a 60 FPS)

---

## 1. Escopo e Objetivos da Subetapa

Eliminar qualquer tempo de espera ou micro-pausa visual durante o arrasto do gráfico para o passado através de **Prefetch Preditivo Antecipado (*Ahead-of-Time Loading*)**:
- Em sistemas comuns, o carregamento só dispara quando o operador atinge a borda esquerda (`range.from < 15`), forçando-o a ver um spinner ou esperar o pacote chegar da rede.
- **Nossa Inovação:** Disparar o pré-carregamento assim que a visão do operador entrar nos **25% mais à esquerda da tela (`range.from < 60`)**. Enquanto o usuário continua arrastando o mouse, o próximo lote de 1.000 barras já é baixado e pré-processado em segundo plano. Quando ele finalmente alcança a borda, os dados **já estão na memória**. O scroll nunca para e nunca engasga.

---

## 2. Passos de Execução Obrigatórios

### Passo 4.1: Gatilho Preditivo de Janela Antecipada no `PriceChart.tsx`
- **Ação:** Elevar o threshold de detecção de proximidade de 15 para 60 barras lógicas:
  ```typescript
  const PREFETCH_THRESHOLD_BARS = 60; // Dispara quando faltar 60 barras para a borda
  ```
- **Critério de Aceite:** O fetch é agendado com antecedência enquanto o usuário ainda possui dezenas de barras visíveis.

### Passo 4.2: Fila de Prefetch Desacoplada e Bloqueio Concorrente
- **Ação:** Garantir que o prefetch não dispare múltiplas requisições simultâneas para o mesmo bloco temporal:
  * Flag `isPrefetchingRef` e `nextPrefetchTimestampRef`.
- **Critério de Aceite:** Exatamente 1 requisição em voo por vez.

### Passo 4.3: Injeção Silenciosa sem Salto de Coordenadas
- **Ação:** As novas barras históricas são mescladas no mapa local; se o usuário ainda não tocou na borda esquerda, a escala não precisa saltar bruscamente; a compensação de coordenada lógica só ocorre no exato momento da expansão do array.
- **Critério de Aceite:** Nenhuma oscilação visível nos indicadores ou nas linhas de preço.

### Passo 4.4: Cancelamento Inteligente em Inversão de Direção
- **Ação:** Se o usuário inverter o scroll e voltar para a direita (em direção ao tempo real), o prefetch do passado não bloqueia os updates ao vivo de ticks.
- **Critério de Aceite:** Prioridade máxima garantida para o tick em tempo real.

### Passo 4.5: Suporte a Lotes Expandidos de 1.000 Barras
- **Ação:** Configurar o chunk de busca histórica para `count = 1000` barras por prefetch.
- **Critério de Aceite:** Com apenas 10 prefetchs silenciosos, o usuário navega os 7 dias completos (10.080 barras).

### Passo 4.6: Teste Automatizado de Scroll Preditivo
- **Ação:** Simular rolagem rápida contínua e verificar se os lotes chegam antes da borda ser atingida.
- **Critério de Aceite:** Zero chamadas síncronas bloqueantes na thread do navegador.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Arrasto Ultra-Rápido):**
  - Usuário move a barra de rolagem em alta velocidade cobrindo 5.000 barras em 3 segundos. O prefetch enfileira e mescla os dados mantendo a taxa de quadros estável em 60 FPS.
- **Segurança (Proteção contra Loops de Fetch):**
  - Quando a barra mais antiga (gênese dos 7 dias) for atingida, `hasMoreHistoryRef` deve se tornar `false`, cessando imediatamente novas requisições.
- **Caos (Latência Variável de Rede):**
  - Injetar 200ms de atraso simulado na rede. O prefetch antecipado absorve a latência sem deixar o usuário sem dados.

---

## 4. Critérios de Aceite da Subetapa 4
- [ ] Prefetch dispara com 60 barras de antecedência.
- [ ] Zero spinners na tela durante rolagem contínua.
- [ ] Lotes de 1.000 barras mesclados em $< 1\text{ms}$.
