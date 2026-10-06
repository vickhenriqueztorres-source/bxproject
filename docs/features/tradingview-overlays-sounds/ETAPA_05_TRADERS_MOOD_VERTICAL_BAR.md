# Subetapa 5: Barra de Sentimento Vertical (Trader's Mood)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**UX & Ergonomia:** `broker-architect-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 5 APROVADO)  

---

## 1. Objetivo da Etapa
Construir a **Barra de Sentimento Vertical (Trader's Mood)** característica da IQ Option:
- Barra vertical ultra-slim (largura de 6px a 8px) fixada na **lateral esquerda interna do canvas do gráfico**.
- Bicolor com divisão proporcional entre Touros (Verde `#00e676` no topo) e Ursos (Vermelho `#ff3d71` na base).
- Tags flutuantes com percentuais:
  - Topo: `68%` verde com ícone ▲.
  - Base: `32%` vermelho com ícone ▼.
- Dinâmica sutil: oscila realisticamente em sincronia com os micro-movimentos do preço (Browniano e momentum de ordens).

---

## 2. Especificação Técnica
- Componente `TradersMoodBar.tsx` posicionado absolutamente sobre o container do gráfico (`position: absolute; left: 16px; top: 70px; bottom: 40px;`).
- Gradiente linear e transição de altura fluida (`transition: height 0.4s ease`).
- Tooltip informativo ao passar o mouse: *"Sentimento dos Traders: 68% esperando alta nos próximos minutos"*.

---

## 3. Matriz de Testes & Validação da Etapa 5

### A. Teste de Responsividade
- Ao redimensionar a altura da viewport:
  - A barra vertical deve se ajustar suavemente sem cortar as tags numéricas.

### B. Teste de Ergonomia
- A barra não deve interferir na navegação do mouse ou na rolagem do gráfico (com `pointer-events: none` nos containers passivos).

---

## 4. Critérios de Passagem (Quality Gate 5)
- [ ] Barra vertical Trader's Mood renderizada com elegância na margem esquerda.
- [ ] Indicadores percentuais dinâmicos e legíveis.
- [ ] Transições de altura fluidas e sem stuttering.
