# Subetapa 3: Integração do Frontend (client.ts & Parâmetros Dinâmicos de Carga)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent`  
**Agente Revisor:** `broker-architect-agent` & `chart-trading-engineer`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `11-chart-trading-tools`  
**Invariantes:** V-05 (Isolamento Estrito de Ativos) | V-11 (Resiliência do Cliente)

---

## 1. Escopo e Objetivos da Subetapa

Atualizar a camada de cliente HTTP no frontend (`apps/web/src/api/client.ts`) para eliminar o limite hardcoded de 100 velas e permitir:
1. **Carga Inicial Otimizada:** Solicitar inicialmente `limit=500` (ou superior) para preencher a tela inteira mesmo em telas ultrawide ou timeframes maiores.
2. **Suporte a Paginação Retroativa:** Adicionar suporte aos parâmetros `before` e `limit` na assinatura de `getCandles`:
   ```typescript
   export const getCandles = async (
     symbol: string,
     interval: string = '1m',
     limit: number = 500,
     before?: number
   ): Promise<Candle[]>
   ```
3. **Função Dedicada de Extensão de Histórico:** Exportar `fetchHistoricalCandlesChunk` para ser invocada pelo motor de Lazy Loading do gráfico sem acoplar com as queries padrão do TanStack Query.

---

## 2. Passos de Execução Obrigatórios

### Passo 3.1: Refatoração da Assinatura de `getCandles` em `client.ts`
- **Ação:** Atualizar a assinatura da função para aceitar `limit` e `before`:
  ```typescript
  export const getCandles = async (
    symbol: string,
    interval: string = '1m',
    limit: number = 500,
    before?: number
  ): Promise<Candle[]> => {
    const apiInterval = /^[1-9]\d{0,6}[mhd]$/.test(interval) ? interval : '1m';
    const params = new URLSearchParams({
      symbol,
      interval: apiInterval,
      limit: String(Math.min(Math.max(1, limit), 1000)),
    });
    if (before && Number.isFinite(before) && before > 0) {
      params.set('before', String(Math.floor(before)));
    }
    const url = `/api/candles?${params.toString()}`;
    // Executa fetch com timeout e fallback
  ```
- **Critério de Aceite:** A URL gerada inclui os parâmetros dinâmicos sanitizados.

### Passo 3.2: Suporte a `before` no Modo Guest / Sessão Local
- **Ação:** Se o usuário estiver em modo convidado ou offline, o fallback em `sessionStorage` deve respeitar o filtro `before`:
  ```typescript
  if (isGuestMode()) {
    const store = getStoredMock();
    let all = store.candles[`${symbol}:${interval}`] ?? store.candles[symbol] ?? [];
    if (before) {
      all = all.filter(c => Number(c.time) < before);
    }
    return all.slice(-limit);
  }
  ```
- **Critério de Aceite:** O modo demo/convidado emula fielmente a paginação retroativa sem erros.

### Passo 3.3: Exposição de Função Auxiliar `fetchHistoricalCandlesChunk`
- **Ação:** Criar helper otimizado para o gráfico:
  ```typescript
  export const fetchHistoricalCandlesChunk = async (
    symbol: string,
    beforeTimestamp: number,
    count: number = 300
  ): Promise<Candle[]> => {
    return getCandles(symbol, '1m', count, beforeTimestamp);
  };
  ```
- **Critério de Aceite:** Função exportada e pronta para integração no `PriceChart.tsx`.

### Passo 3.4: Atualização da Query no `App.tsx`
- **Ação:** Atualizar o `useQuery` de velas no componente principal para solicitar 500 barras:
  ```typescript
  const candles = useQuery({
    queryKey: ['candles', activeSymbol],
    queryFn: () => getCandles(activeSymbol, '1m', 500),
  });
  ```
- **Critério de Aceite:** O gráfico inicializa imediatamente com 500 velas (mais de 8 horas de dados) em vez de 100.

### Passo 3.5: Ajuste no Multi-Chart Grid
- **Ação:** Em `apps/web/src/chart/MultiChartGrid.tsx`, atualizar a chamada de `getCandles` para solicitar um lote confortável de 300 a 500 velas por célula da grade.
- **Critério de Aceite:** Todas as células da grade exibem histórico profundo de candles.

### Passo 3.6: Testes Unitários de Cliente
- **Ação:** Criar testes unitários para validar a montagem de queries de `client.ts` com diferentes combinações de argumentos.
- **Critério de Aceite:** 100% dos testes passando.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Troca Rápida de Ativos):**
  - O usuário clica rapidamente em 10 abas de ativos diferentes. O `AbortSignal.timeout(6000)` deve cancelar requisições obsoletas e evitar sobreposição de dados.
- **Segurança (Sanitização no Cliente):**
  - Garantir que nenhum `before` negativo ou caractere inválido seja transmitido via query string.
- **Caos (Timeout de Rede no Histórico):**
  - Simular atraso artificial de 8 segundos na rede durante o scroll histórico. O cliente deve capturar o erro com aviso não-bloqueante no console e manter as velas já exibidas sem quebrar a UI.

---

## 4. Critérios de Aceite da Subetapa 3
- [ ] `getCandles` aceita `limit` configurável (padrão 500) e `before` numérico.
- [ ] Carga inicial carrega no mínimo 500 barras de histórico (mais de 8 horas contínuas).
- [ ] Modo Guest suporta paginação em memória sem quebras.
- [ ] Compilação do frontend limpa via `pnpm build` ou `tsc`.
