# SUBETAPA 1: Motor Estocástico de Velas Realistas (Ornstein-Uhlenbeck & Box-Muller)

> **Data:** 08/10/2026  
> **Status:** PLANEJADO  
> **Responsáveis:** `broker-architect-agent`, `qa-resilience-agent`, `surgical-frontend-agent`  

---

## 1. Problema Abordado e Objetivos

### Diagnóstico Fático:
A imagem anexada pelo usuário evidencia um gráfico onde as velas formam uma **onda senoidal artificial perfeita**, alternando ciclos idênticos de 4-5 velas verdes seguidas de 4-5 velas vermelhas.
Isso ocorre porque a função `generateSeedCandles` em `apps/web/src/api/client.ts` utiliza `Math.sin(time * 0.001 + i) * step`.
Da mesma forma, no `TradingFeedManager.ts`, a geração de ruído fallback em modo de teste ou convidado utilizava `Math.sin(...)`.

### Objetivos da Subetapa:
1. Eliminar completamente o uso de funções senoidais (`Math.sin`) na geração de séries de preços e velas.
2. Implementar um **Processo Estocástico de Reversão à Média (Ornstein-Uhlenbeck)** acoplado com **Ruído Gaussiano via Transformação de Box-Muller**:
   $$dX_t = \theta (\mu - X_t) dt + \sigma dW_t$$
   Onde $dW_t = Z \sqrt{dt}$ com $Z \sim \mathcal{N}(0, 1)$ gerado por Box-Muller.
3. Gerar pavios e sombras realistas (sombras superior e inferior assimétricas):
   $$High = \max(Open, Close) + |Z_{wick1}| \cdot \sigma_{wick}$$
   $$Low = \min(Open, Close) - |Z_{wick2}| \cdot \sigma_{wick}$$
4. Garantir que as velas geradas possuam volatilidade orgânica, micro-tendências locais (momentum com persistência parcial) e pareçam 100% autênticas com gráficos reais de Forex, Cripto e Índices Sintéticos OTC.
5. Manter determinismo de semente (seeded PRNG) para que renderizações sucessivas sem rede não criem saltos descontínuos desnecessários entre renders.

---

## 2. Especificação Técnica e Algoritmo

### 2.1. Gerador Gaussiano Box-Muller com Seeded PRNG
```ts
// Gerador LCG/Mulberry32 rápido com semente determinística
function createSeededRng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Transformada de Box-Muller para ruído gaussiano N(0, 1)
function boxMuller(rng: () => number): number {
  let u1 = rng();
  let u2 = rng();
  while (u1 <= 1e-15) u1 = rng(); // Previne log(0)
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}
```

### 2.2. Algoritmo de Velas OHLCV em `generateSeedCandles`
- Preço base $\mu$ baseado no catálogo do ativo (`getAssetBasePrice(symbol)`).
- Volatilidade diária/minutária $\sigma$ dimensionada por classe de ativo (Forex, Cripto, Índices Sintéticos, Commodities).
- Reversão à média suave $\theta = 0.03$ para ancorar no preço base sem rigidez artificial.
- Coeficiente de momentum $0.35$ para permitir velas consecutivas na mesma direção de tendência orgânica.
- Volumes estocásticos variando com o tamanho do corpo da vela (maior volume em velas com maior amplitude).

---

## 3. Matriz de Testes e Validação Obrigatória

Os testes serão implementados em `apps/web/src/trade/stochastic-candles.unit.test.ts`:

| Código | Descrição do Teste | Critério de Aceite |
|---|---|---|
| **ST-01** | **Integridade Estrutural das Velas:** Valida $High \ge \max(Open, Close)$ e $Low \le \min(Open, Close)$ em 3.500 velas consecutivas. | 100% de conformidade, zero velas inválidas. |
| **ST-02** | **Não-Periodicidade & Ausência de Senoide:** Calcula a autocorrelação de retornos e prova que não há cristas periódicas de senoide (autocorrelação a lag 6 < 0.25). | Desvio padrão orgânico, ausência de padrão repetitivo. |
| **ST-03** | **Diversidade por Classe de Ativo:** Testa geração para `EURUSD_OTC` (Forex), `BTCUSD_OTC` (Cripto) e `SYNTH_VOL_50` (Sintético), validando escalas de preços e casas decimais. | Precisão decimal exata por classe. |
| **ST-04** | **Performance Extrema:** Geração de 1.000 velas em janela contínua em menos de 20ms. | Execução sem bloqueio da thread gráfica. |
| **ST-05** | **Prevenção de Preços Negativos:** Nenhuma vela em qualquer cenário de estresse possui preço $\le 0$. | Preço estritamente positivo em todas as circunstâncias. |

---

## 4. Critérios de Homologação da Subetapa 1

1. Todos os 5 testes da suíte `stochastic-candles.unit.test.ts` aprovados.
2. Suíte global de trading (`apps/web/src/trade/`) continua 100% verde sem regressões.
3. Relatório de homologação formal registrado em `docs/relatorios/RELATORIO_SUBETAPA_1_VELAS_ESTOCASTICAS.md`.
