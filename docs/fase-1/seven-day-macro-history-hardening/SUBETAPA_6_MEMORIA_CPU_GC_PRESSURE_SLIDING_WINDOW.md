# Subetapa 6: Janela Deslizante de 3.500 Barras e Controle de Pressão de GC

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `11-chart-trading-tools`  
**Invariantes:** V-11 (Taxa de Quadros Fixa a 60 FPS / Heap Estável)

---

## 1. Escopo e Objetivos da Subetapa

Garantir que a expansão para 7 dias de histórico não aumente a pressão sobre o **Garbage Collector (GC) do V8** nem degrade a renderização a 60 FPS:
* No Lightweight Charts, manter entre **2.000 e 3.500 barras ativas** na série do Canvas é o *ponto ideal de engenharia* (renderização a 60 FPS consumindo menos de $25\text{MB}$ de heap).
* Como 7 dias em 5m equivalem a **2.016 barras**, a visão semanal inteira cabe confortavelmente dentro do teto sem nenhuma poda.
* Se o operador navegar profundamente no passado em 1m, o algoritmo de **Janela Deslizante Inteligente (*Smart Sliding Window*)** preserva uma janela de 3.500 barras centralizada na visão atual do operador, reciclando objetos e evitando picos de GC pauses.

---

## 2. Passos de Execução Obrigatórios

### Passo 6.1: Calibração da Constante de Teto do Canvas
- **Ação:** Em `PriceChart.tsx`:
  ```typescript
  const MAX_ACTIVE_CANVAS_BARS = 3500; // Teto ideal para 60 FPS contínuos
  ```
- **Critério de Aceite:** O teto comporta perfeitamente a semana inteira em 5m (2.016 barras) e até 58 horas contínuas em 1m.

### Passo 6.2: Algoritmo de Poda Bidirecional Centralizado no Viewport
- **Ação:** Ao mesclar fatias históricas no `PriceChart.tsx`:
  * Identificar se a visualização do usuário está ancorada no presente ou no passado.
  * Se estiver no passado profundo, podar o excesso de barras da ponta do futuro.
  * Se estiver no presente, podar o passado ultra-distante que já saiu da tela.
- **Critério de Aceite:** O array ativo no componente visual nunca ultrapassa 3.500 elementos.

### Passo 6.3: Reciclagem de Objetos e Redução de Alocações
- **Ação:** Evitar a criação de novos arrays desnecessários no loop de animação do `RafChartUpdater`.
- **Critério de Aceite:** Zero pausas perceptíveis de Garbage Collection durante a chegada de múltiplos ticks por segundo.

### Passo 6.4: Transição Suave no Botão "Voltar ao Tempo Real"
- **Ação:** Quando o trader clica para retornar ao presente, recarregar as 2.880 barras mais recentes de forma atômica e rolar para o tick ao vivo em $< 10\text{ms}$.
- **Critério de Aceite:** Retorno instantâneo e suave.

### Passo 6.5: Monitoramento Contínuo de Memória Heap
- **Ação:** Logar alertas em modo debug se o heap da aba do navegador sofrer variação superior a 5 MB em 1 minuto.
- **Critério de Aceite:** Consumo de heap constante e estável.

### Passo 6.6: Teste de Resistência de Longa Duração
- **Ação:** Simular navegação contínua por 10 minutos com scrolls e ticks ininterruptos.
- **Critério de Aceite:** Zero vazamento de memória (heap linear sem inclinação ascendente).

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Scroll Bidirecional Frenético):**
  - Navegar rapidamente do passado para o presente 30 vezes. O array deve se manter dentro de 3.500 barras sem corrupção de dados.
- **Segurança (Consistência de Indicadores sob Poda):**
  - Os 10 indicadores técnicos devem manter seus períodos matemáticos corretos sem erros de índice fora de limites (*out of bounds*).
- **Caos (Execução em Dispositivo Móvel / CPU Throttled 4x):**
  - Simular CPU 4x mais lenta no DevTools. A taxa de quadros deve se manter acima de 55 FPS.

---

## 4. Critérios de Aceite da Subetapa 6
- [ ] Teto rígido de 3.500 barras ativas no Canvas.
- [ ] 60 FPS fixos mesmo sob carga pesada de ticks.
- [ ] Zero vazamento de memória comprovado em testes de longa duração.
