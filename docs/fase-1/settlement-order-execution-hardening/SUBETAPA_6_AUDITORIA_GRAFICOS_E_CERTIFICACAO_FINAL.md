# Subetapa 6 — Auditoria Forense dos Gráficos e Certificação Final de Ponta a Ponta

## 1. Objetivo
Atuar como Expert em Debugging de Gráficos de Trading para auditar detalhadamente todas as implementações anteriores no Lightweight Charts, garantindo que não restou nenhum bug, gargalo ou vazamento na renderização de velas, linhas de strike, timeframes e overlays.

## 2. Itens de Auditoria Forense Gráfica

| Item Auditado | Diagnóstico e Verificação | Status |
| :--- | :--- | :--- |
| **Invariante OHLC** | Velas garantem $\text{low} \le \min(\text{open}, \text{close}) \le \max(\text{open}, \text{close}) \le \text{high}$ | ✅ Auditado & Blindado |
| **Carga de Velas** | 100 velas históricas carregadas via REST público tanto no guest quanto em produção | ✅ Auditado & Blindado |
| **Throttling rAF** | Máximo de 1 paint a cada 16.6ms (60fps) por célula da grade | ✅ Auditado & Blindado |
| **Linhas de Strike** | Linhas horizontais `PriceLine` plotadas ao abrir ordem e expurgadas após liquidação | ✅ Auditado & Blindado |
| **Overlays de Staleness** | Overlay visual de congelamento ativa após 4s de silêncio e remove no primeiro tick | ✅ Auditado & Blindado |
| **Troca de Timeframes** | Resampling dinâmico sem sobreposição temporal ou descontinuidade de UTCTimestamp | ✅ Auditado & Blindado |
| **Gestão de GPU/Canvas** | Máximo de 6 contextos Canvas ativos, bem abaixo do limite de 16 do Chromium | ✅ Auditado & Blindado |

## 3. Critérios de Homologação Final
- Ordem enviada pelo usuário abre sem erro.
- A linha de strike aparece imediatamente no gráfico do ativo selecionado.
- Contrato é liquidado automaticamente após 60s.
- O saldo demo e o histórico de ordens são atualizados reativamente sem recarregar a página.
