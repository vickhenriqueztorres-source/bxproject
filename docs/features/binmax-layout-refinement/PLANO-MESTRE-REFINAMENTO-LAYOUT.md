# PLANO MESTRE: REFINAMENTO ERGONÔMICO DO TRADEROOM BINMAX

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`  
**Orquestrador Chefe:** `tech-lead-orchestrator` / `broker-architect-agent`  
**Especialistas Convocados:**
- `broker-architect-agent`: Geometria, proporções espaciais e isolamento da área gráfica.
- `surgical-frontend-agent` (`cirurgiao`): Implementação cirúrgica com menor diff, protegida pela feature flag `NEW_TRADEROOM`.
- `qa-resilience-agent`: Testes de estresse de renderização, tolerância a falhas, testes de caos e regressão.
- `financial-correctness-reviewer`: Preservação dos invariantes financeiros (minor units, saldo sem alteração de lógica).
- `compliance-risk-reviewer`: Acessibilidade touch/desktop e fidelidade aos botões de ação rápida.

---

## 1. Visão Geral da Demanda

O usuário forneceu duas capturas de alta definição evidenciando o padrão de proporções ideal do Traderoom Binmax:
1. **Imagem 1 (Sidebar Vertical)**: Barra lateral confortável (~72px), ícones grandes (~24px) com cores vibrantes (Ciano `#00e5ff` em ativo), rótulos em tipografia legível (~11px) e cabeçalho com chevron duplo `▲▲`.
2. **Imagem 2 (Header Superior Direito)**: Módulo de conta institucional expandido com avatar circular de 32px, rótulo `Cuenta de práctica ▼`, saldo em verde institucional de 16px (`Geist Mono`), botão `💳 Depositar` amplo e de alto contraste, e botão `Salir`.
3. **Instrução Central**: *"Diminuir tamanho do card geral do grafico.. sem mexer absolutamente nada na logica atual e aumentar o tamanho desses elementos.. porque estao muito pequenos"*.

---

## 2. Princípios e Invariantes Invioláveis

1. **Lógica Intocada**: Nenhuma alteração nas séries temporais, cálculo de candles, WebSocket Gateway, feed manager, cálculo de payout ou submissão de ordens.
2. **Redimensionamento Passivo do Gráfico**: A redução da área do card do gráfico é puramente geométrica/CSS (`padding`/`margin`/`box-sizing`), permitindo que a engine do Lightweight Charts calcule seu tamanho nativo via `ResizeObserver` sem gaps ou distorções.
3. **Fidelidade Visual às Referências**: Adoção estrita das medidas, cores e pesos tipográficos das imagens fornecidas.
4. **Protocolo de Gates Estrito**: Subetapa $N+1$ só é iniciada após o fechamento formal com 100% de testes verdes da Subetapa $N$.

---

## 3. Divisão em Subetapas Sequenciais

| Subetapa | Arquivo de Especificação | Foco Técnico |
|---|---|---|
| **01** | `SUBETAPA-01-DIMENSOES-SHELL-E-CARD-GRAFICO.md` | Redução do card geral do gráfico via moldura/padding institucional em `.terminal-center` |
| **02** | `SUBETAPA-02-EXPANSAO-SIDEBAR-E-ICONES.md` | Ampliação do Sidebar para 72px, ícones 24px, textos 11px e topo duplo chevron (Imagem 1) |
| **03** | `SUBETAPA-03-EXPANSAO-HEADER-SALDO-E-DEPOSITO.md` | Ampliação do Header (56px), Avatar (32px), Saldo (16px) e Botão Depositar (Imagem 2) |
| **04** | `SUBETAPA-04-CERTIFICACAO-FINAL-SEM-REGRESSAO.md` | Bateria completa de 469+ testes, estresse, caos e homologação final |
