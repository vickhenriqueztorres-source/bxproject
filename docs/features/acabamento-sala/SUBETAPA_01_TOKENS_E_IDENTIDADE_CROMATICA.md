# SUBETAPA 01 — TOKENS E IDENTIDADE CROMÁTICA INSTITUCIONAL
## Refinamento Cromático, Eliminação de Neon Amador e Padronização de Cantos/Bordas

**Data:** 09/10/2026  
**Responsáveis:** `binmax-brand-agent`, `surgical-frontend-agent`, `guardiao-regressao`  
**Escopo de Arquivos Autorizados:**
- `apps/web/src/styles.css`
- `apps/web/src/components/sidebar/SidebarDock.tsx`
- `apps/web/src/components/header/TerminalHeader.tsx`
- `apps/web/src/components/header/AccountSelectorDropdown.tsx`
- `apps/web/src/trade/OrderTicket.tsx`
- `apps/web/src/chart/IsolatedChartHost.tsx`

---

## 1. Objetivos Técnicos e Mudanças Cirúrgicas

1. **Eliminação do Neon Azul/Ciano:**
   - Em `SidebarDock.tsx`: substituir `rgba(0, 229, 255, 0.08)` e `borderLeft: 3px solid #00e5ff` por fundo discreto, texto/ícone em branco `#E6EAF0` / `#F4F5F7` e barra indicadora lateral de 2px em verde `#22C55E` sem glow.
   - Nas abas do `TerminalHeader.tsx`: substituir a borda ativa `#00e5ff` e sombra neon por borda neutra com indicador sutil.
2. **Harmonização do Verde de Ação e Ganho (`#22C55E`):**
   - Unificar o botão SUBE, payout `+85%`, toasts de ganho e velas de alta para `#22C55E`.
   - Ajustar o saldo da conta demo/real para branco tabular `#F4F5F7` com rótulo cinza `#8A92A1` (conforme IQ Option, evitando o excesso de verde no topo).
3. **Harmonização do Vermelho Sóbrio (`#E5484D`):**
   - Substituir o vermelho rosado `#F2545B` / `#ff3d71` no botão BAJA, nas velas de baixa e nas linhas de tempo para `#E5484D`.
4. **Padronização Geométrica:**
   - Cantos consistentes de 6px (`border-radius: 6px`) em todos os cards, abas e botões.
   - Bordas de 1px em `#1F2A3A` (substituindo bordas coloridas ou mais claras).

---

## 2. Passo a Passo de Execução

- **Passo 1.1:** Atualizar as variáveis de token no `apps/web/src/styles.css` na classe `.theme-binmax`:
  `--bm-verde: #22C55E;`
  `--bm-rojo: #E5484D;`
  `--bm-linha: #1F2A3A;`
  `--bm-raio-sm: 6px;`
- **Passo 1.2:** Ajustar `SidebarDock.tsx` para remover qualquer traço de `#00e5ff` no item ativo, adotando branco `#F4F5F7` com borda lateral de 2px em `#22C55E`.
- **Passo 1.3:** Ajustar `TerminalHeader.tsx` e `AccountSelectorDropdown.tsx` para que o saldo tabular seja renderizado em branco `#F4F5F7`, removendo brilhos neon de botões e abas.
- **Passo 1.4:** Ajustar `OrderTicket.tsx` e `IsolatedChartHost.tsx` para utilizarem `#22C55E` (alta) e `#E5484D` (baixa), aplicando hover sóbrio (+6% luminosidade sem box-shadow difuso).

---

## 3. Protocolo de Testes e Validação

### Testes de Estresse Visual e Renderização
- **TEST-01 (CSS Leakage & Scope):** Verificar que nenhum token `.theme-binmax` vaza para fora do container do traderoom quando a flag `NEW_TRADEROOM` estiver desativada.
- **TEST-02 (Contrast Ratio WCAG AA):** Garantir que os contrastes entre texto e fundo atendam aos padrões de acessibilidade (branco `#F4F5F7` sobre `#0D0F14` com ratio > 12:1; texto cinza `#8A92A1` com ratio > 4.5:1).

### Testes de Caos
- **CHAOS-01 (Rapid Theme Toggle):** Alternar a classe `.theme-binmax` e layouts rapidamente a 60 FPS e verificar que não ocorrem saltos geométricos (layout shifts/CLS = 0).

### Testes de Segurança e Integridade
- **SEC-01 (Zero Business Logic Touch):** Garantir que nenhuma alteração afete os cálculos de stake, payout do backend ou envio de ordens.

---

## 4. Critérios de Aceite para Fechamento da Subetapa

- [ ] Zero ocorrências de ciano neon `#00e5ff` no item Operar e abas ativas.
- [ ] Botão SUBE utiliza `#22C55E` e botão BAJA utiliza `#E5484D`.
- [ ] Saldo do cabeçalho renderizado em branco `#F4F5F7`.
- [ ] Todos os 425 testes legados continuam passando sem falhas.
- [ ] Novo arquivo de teste unitário `apps/web/src/trade/subetapa-18-01-tokens-cromatica.unit.test.tsx` com 100% de aprovação.
