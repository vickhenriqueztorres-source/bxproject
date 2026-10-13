# Subetapa 03: Grid de Dados Operacionais em Tempo Real & Histórico

> **Módulo**: `PortfolioDrawer.tsx` / `apps/web/src/components/drawer/PortfolioDrawer.tsx`  
> **Responsáveis**: `chief-visual-director`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Status**: Aguardando Conclusão da Subetapa 02  

---

## 1. Objetivos de Design e Engenharia

1. **Cabeçalhos Tabulares de Alta Densidade**:
   - Tipografia Geist Sans 11px uppercase com espaçamento sutil (`letter-spacing: 0.04em`), cor `--text-muted` (`#8A92A1`).
   - Alinhamento ergonômico por tipo de dado (texto à esquerda, números monetários e percentuais à direita).
2. **Linhas de Operações Abertas (Real-Time)**:
   - Identificação do ativo com ícone de bandeira oficial (`AssetFlagBadge`), nome formatado e ID curto em Geist Mono.
   - Tag de direção com ícone vetorial de precisão: `↑ SUBE` em verde esmeralda (`#22C47A`) / `↓ BAJA` em vermelho (`#F2545B`).
   - Valor investido formatado estritamente via `formatCurrencyBinmax` / `formatMinor`.
   - Cronômetro restante em Geist Mono tabular `tabular-nums` com barra de progresso suave em fundo discreto.
   - P&L potencial calculado sem manipular saldo.
3. **Linhas de Histórico Fechado**:
   - Badge de resultado sem drama: `GANADA` em verde suave, `EMPATE` em âmbar, `PERDIDA` em vermelho sóbrio.
   - Retorno oficial liquidado em Geist Mono tabular.
4. **Motion e Microinterações**:
   - Efeito hover em cada linha da tabela iluminando a superfície em 100ms (`--bm-ease`).

---

## 2. Bateria de Testes Exigida

- **Unitário**:
  - Testar formatação de números em Geist Mono.
  - Testar exibição de `AssetFlagBadge` e títulos de abas.
  - Testar badges de resultado para WIN, DRAW e LOSS.
- **Estresse**:
  - Renderizar 50 contratos ativos simultâneos com atualizações de timestamp em < 50ms.
- **Segurança**:
  - Garantir ausência de injeção de tags em IDs de contratos, direções e valores.
