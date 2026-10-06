# Subetapa 2: Linha de Preço Atual com Tag Pulsante

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**UX & Ergonomia:** `broker-architect-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 2 APROVADO)  

---

## 1. Objetivo da Etapa
Construir a **Linha de Preço em Tempo Real com Tag Pulsante** colada na extremidade direita da vela atual:
- Linha horizontal de cotação atual projetada sobre o canvas com estilo tracejado sutil (`#00e676` quando o último tick subiu, `#ff3d71` quando desceu).
- Tag de Preço Flutuante (Price Badge):
  - Badge em alto relevo com tipografia monospace/grotesk exibindo o preço exato.
  - Indicador de seta (▲ ou ▼).
  - Ponto de emissão pulsante (glow ring animado) no vértice da vela atual no canvas.

---

## 2. Especificação Técnica
- Integração via camada de overlay SVG e API de linhas de preço do TradingView Lightweight Charts (`series.createPriceLine` ou overlay customizado de alta precisão).
- Animação de pulso CSS com `@keyframes pulseTag` sem reflow do DOM.
- Transição fluida de cor entre verde e vermelho conforme a direção do tick.

---

## 3. Matriz de Testes & Validação da Etapa 2

### A. Teste de Estresse (Frequência de Ticks e Pulso)
- Injetar 50 ticks/segundo no preço:
  - A tag deve atualizar suavemente sem trepidação (jitter) visual.
  - A linha de preço deve acompanhar a cotação sem desfasamento.

### B. Teste de Redimensionamento
- Ao alterar dimensões da janela ou colapsar painéis:
  - A tag e a linha devem permanecer estritamente alinhadas à escala de preços do gráfico.

---

## 4. Critérios de Passagem (Quality Gate 2)
- [ ] Linha de cotação atual visível e dinâmica.
- [ ] Tag com indicador direcional e animação de pulso suave.
- [ ] Build 100% verde sem warnings.
