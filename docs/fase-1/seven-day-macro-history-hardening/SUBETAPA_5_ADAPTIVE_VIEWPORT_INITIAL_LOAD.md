# Subetapa 5: Carga Inicial Adaptativa por Timeframe (1m = 48h, 5m = 7 dias)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `chart-trading-engineer`  
**Agente Revisor:** `backend-implementation-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `11-chart-trading-tools`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-11 (Interface Instantânea)

---

## 1. Escopo e Objetivos da Subetapa

Implementar o mecanismo de **Carga Inicial Adaptativa por Timeframe (*Smart Viewport Bootstrap*)**:
- Em vez de uma quantidade fixa arbitrária, o volume inicial de velas solicitado pelo frontend é calibrado dinamicamente para o timeframe em uso:
  * **Timeframe 1m:** Solicita **1.440 a 2.880 barras** (24h a 48h imediatas no arranque).
  * **Timeframe 5m:** Solicita **2.016 barras** (os **7 dias completos** consolidados em uma única requisição levíssima de $\approx 32\text{ KB}$).
  * **Timeframe 15m:** Solicita **672 barras** (os 7 dias completos instantâneos).
  * **Timeframe 1h:** Solicita **168 barras** (os 7 dias completos instantâneos).
- **Resultado:** O trader obtém a visão macro máxima possível em qualquer resolução de tempo, com tempo de primeiro paint (*First Contentful Paint do Gráfico*) inferior a **35 milissegundos**.

---

## 2. Passos de Execução Obrigatórios

### Passo 5.1: Função de Resolução de Limite por Timeframe
- **Ação:** Em `apps/web/src/api/client.ts` ou `candle-adapter.ts`:
  ```typescript
  export function getOptimalCandleLimit(timeframe: Timeframe): number {
    switch (timeframe) {
      case '5s':
      case '15s':
      case '30s':
        return 720; // Horas recentes em alta frequência
      case '1m':
        return 2880; // 48 horas no minuto a minuto
      case '5m':
        return 2016; // 7 dias completos
      default:
        return 1440;
    }
  }
  ```
- **Critério de Aceite:** Limites otimizados para cada perfil de visualização.

### Passo 5.2: Atualização do Boot de Velas no `App.tsx`
- **Ação:** Configurar a query principal para utilizar o limite otimizado de 48 horas (2.880 barras) na base de 1m:
  ```typescript
  queryFn: () => getCandles(activeSymbol, '1m', 2880),
  ```
- **Critério de Aceite:** O gráfico abre com 2 dias inteiros visíveis de imediato no boot.

### Passo 5.3: Habilitação de 7 Dias Imediatos ao Alternar para 5m
- **Ação:** Ao alternar para o timeframe de 5 minutos, o cliente aproveita o buffer de 7 dias disponível no backend, exibindo a semana inteira de ponta a ponta.
- **Critério de Aceite:** Timeframe 5m cobre os 7 dias completos sem buracos.

### Passo 5.4: Fallback Gracioso no Modo Convidado / Mock
- **Ação:** Garantir que o mock de `sessionStorage` sintetiza e armazena os 7 dias completos sem truncamento.
- **Critério de Aceite:** Modo demo reflete exatamente o comportamento de produção.

### Passo 5.5: Ajuste de Zoom Automático no Primeiro Render
- **Ação:** Após injetar as barras adaptativas, ajustar o range visual para exibir confortavelmente as últimas 150 a 300 barras, deixando o passado pronto para navegação via scroll.
- **Critério de Aceite:** As velas têm tamanho ideal de leitura no primeiro segundo de visualização.

### Passo 5.6: Teste de Carga Inicial Adaptativa
- **Ação:** Validar tempo de boot em conexões 4G simuladas (throttling de rede).
- **Critério de Aceite:** Primeiro render completo em $< 50\text{ms}$.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Troca Rápida de Ativos sob 2.880 Barras):**
  - Alternar entre 10 ativos em sequência rápida. O consumo de memória do navegador deve estabilizar sem picos de heap.
- **Segurança (Respeito aos Limites do Backend):**
  - Todas as requisições geradas respeitam o teto máximo de 10.080 barras.
- **Caos (Conexão Lenta com Alta Densidade de Dados):**
  - Simular conexão 3G móvel. O gzip do Nginx garante entrega em $< 120\text{ms}$.

---

## 4. Critérios de Aceite da Subetapa 5
- [ ] 1m abre com 2.880 barras (48h contínuas).
- [ ] 5m abre com 2.016 barras (7 dias completos).
- [ ] Tempo de primeiro paint do gráfico $< 35\text{ms}$.
