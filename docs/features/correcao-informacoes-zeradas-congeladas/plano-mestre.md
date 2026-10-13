# PLANO MESTRE: Resolução Definitiva de Informações Zeradas e Ordens Congeladas na Tela

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agente Executor**: `surgical-frontend-agent`  
> **Agentes de Auditoria & Validação**: `financial-correctness-reviewer`, `qa-resilience-agent`, `regression-guardian-agent`, `chart-trading-engineer`  
> **Skills Ativas**: `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `11-chart-trading-tools`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`, `20-conduzir-etapa`  
> **Status**: INICIADO — Execução Sequencial Rigorosa

---

## 1. Análise da Causa Raiz e Diagnóstico Técnico Forense

A partir da imagem enviada pelo operador e da auditoria aprofundada do código-fonte, foram identificadas duas anomalias críticas no ecossistema de exibição e liquidação:

### Anomalia 1: Informações Zeradas no Rodapé (`Portafolio total $0.00` e `Ganancia de hoy $0.00`)
- **Evidência**: No print, o rodapé exibe `Portafolio total $0.00 | Ganancia de hoy $0.00 | Operaciones abiertas 4`, enquanto há 4 operações abertas de $100 ($400 total) e um histórico de 45 operações fechadas (`Historial cerrado (45)`).
- **Causa Raiz**: No arquivo `apps/web/src/App.tsx` (linhas 269–270), os valores repassados para `<TerminalFooter />` estavam fixados como strings hardcoded:
  ```tsx
  portfolioTotalFormatted="$0.00"
  todayProfitFormatted="$0.00"
  ```
- **Solução Arquitetural**: Implementar o cálculo dinâmico de `openPortfolioMinor` (soma das stakes dos contratos com status `OPEN`) e `todayNetProfitMinor` (soma dos lucros de WIN menos perdas de LOSS dos contratos liquidados no dia de hoje), formatando com precisão monetária e suporte a cores dinâmicas (verde para lucro, vermelho para prejuízo, neutro para zero).

### Anomalia 2: Contratos Expirados Congelados em `0s` / `00:00` e Flags Presas no Gráfico
- **Evidência**: No print, as ordens `#ORD-ED9051` e `#ORD-D3A67B` estão com tempo restante `0s`, barra de progresso a 100%, mas continuam listadas em `Operaciones abiertas (4)`. No gráfico, a flag de strike permanece desenhada e congelada em `▲ $100 | 00:00`.
- **Causa Raiz**:
  1. No modo Guest / Local Storage (`apps/web/src/api/client.ts`), a liquidação dependia exclusivamente de um `setTimeout` agendado na memória JavaScript. Se a página sofria refresh, se a aba entrava em segundo plano (onde navegadores congelam ou throttlam timers), ou se o usuário navegava entre rotas, o `setTimeout` era cancelado e NUNCA mais executava.
  2. Ao recarregar a página, a função `getContracts('')` lia o `store.contracts` do `localStorage` sem rodar nenhuma reconciliação de tempo (`expires_at <= Date.now()`). O contrato permanecia para sempre com `status: 'OPEN'`.
  3. No componente `PortfolioDrawer.tsx`, quando `now >= expEpoch`, calculava `secondsLeft = 0s`, mas como o status permanecia `OPEN`, exibia "En curso" indefinidamente e inflacionava a `Ganancia potencial: +$340.00`.
  4. No componente `OrderFlagsOverlay.tsx`, a flag de strike filtrava apenas `status === 'OPEN'` e exibia `00:00` fixo no gráfico, sem expirar nem dar lugar ao `ExpirationResultPin`.
- **Solução Arquitetural**:
  1. Criar motor de auto-reconciliação autônomo no mock store (`reconcileGuestContracts`): toda chamada a `getContracts()`, `getContract()`, `getWallet()` ou batimento periódico verifica contratos vencidos, liquida transacionalmente no store, atualiza a carteira e despacha os eventos `contract_settled` e `wallet_balance`.
  2. Adicionar batimento de ciclo de vida no frontend: quando `secondsLeft <= 0`, o status passa visualmente para "Liquidando...", e um sinalizador força a sincronização imediata.
  3. No gráfico (`OrderFlagsOverlay`), contratos com tempo esgotado não devem exibir `00:00` indefinidamente; ao liquidarem, a flag de strike é removida de imediato e o `ExpirationResultPin` de encerramento assume a coordenada com animação limpa.

---

## 2. Divisão em Subetapas Completas

A execução será estritamente sequencial, validando cada etapa com testes antes de prosseguir:

| Subetapa | Nome | Arquivo de Especificação | Foco Principal |
|---|---|---|---|
| **Subetapa 01** | Motor de Reconciliação Autônomo e Liquidação Resiliente no Client / Mock Store | `subetapa-01-motor-reconciliacao-guest.md` | Auto-cura de contratos expirados no storage, liquidação determinística, ajuste atômico da carteira. |
| **Subetapa 02** | Descongelamento do Terminal, Transição "Liquidando..." e Limpeza de Flags no Gráfico | `subetapa-02-descongelamento-overlays-drawer.md` | Estado visual "Liquidando...", remoção de flags `00:00`, transição para `ExpirationResultPin`. |
| **Subetapa 03** | Métricas Dinâmicas e Reativas de Rodapé (`Portafolio Total` e `Ganancia de Hoy`) | `subetapa-03-metricas-rodape-reativas.md` | Cálculo reativo no `App.tsx` e estilização cromática dinâmica no `TerminalFooter.tsx`. |
| **Subetapa 04** | Bateria Global de Estresse, Caos, Segurança Financeira e Certificação sem Regressão | `subetapa-04-testes-estresse-caos-seguranca.md` | 100 contratos expirados simultâneos, crash recovery, invariantes financeiros, 0 regressões. |

---

## 3. Protocolo de Portões de Qualidade (Gates)

NENHUMA etapa é considerada concluída sem:
1. Teste unitário e de integração dedicado verde no Vitest.
2. Prova de invariantes financeiros (conservação de valor da carteira demo, soma zero).
3. Teste de estresse / casos limites (timers zerados, timestamps passados, valores negativos ou nulos).
4. Verificação de ausência de regressões na suíte geral do projeto.
