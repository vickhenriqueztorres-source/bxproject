# Relatório da Etapa 13 — Planejamento e Arquitetura das Próximas Telas do Dashboard

**Data:** 08 de Outubro de 2026  
**Responsável:** `tech-lead-orchestrator` com o pool de agentes  
**Status:** **HOMOLOGADO E ESTRUTURADO**

---

## 1. Visão Geral

Com a Sala de Operações (Traderoom) 100% concluída, testada e validada nas Etapas 01 a 12, a Etapa 13 estabelece o roadmap arquitetural e os contratos de design para a expansão do ecossistema Binmax Option, cobrindo as 6 telas periféricas de engajamento e monetização.

---

## 2. Mapa das 6 Próximas Telas (Roadmap de Execução)

| Código | Tela | Objetivo de Negócio | Feature Flag Dedicada | Zona Sensível Adicional |
|:---|:---|:---|:---|:---|
| **13.1** | **Depósito en 2 clics** | Conversão de First-Time Deposit (FTD), PIX/SPEI/Cripto em modal rápido | `FEATURE_DEPOSIT_MODAL` | **VERMELHO:** Gateway, Webhook, Blnk Ledger |
| **13.2** | **Onboarding Demo** | Guiar o lead novo do primeiro clique à primeira vitória prática | `FEATURE_DEMO_ONBOARDING` | **AMARELO:** State machine do tour |
| **13.3** | **Mi Binmax (Home)** | Dashboard pós-login com atalhos, saldo e top ativos em payout | `FEATURE_HOME_DASHBOARD` | **VERDE:** Layout de apresentação |
| **13.4** | **Mi Rendimiento** | Gráfico de evolução de patrimônio, winrate e histórico analítico | `FEATURE_PERFORMANCE_ANALYTICS` | **VERDE:** Consultas analíticas somente-leitura |
| **13.5** | **Torneos** | Leaderboard competitivo ao vivo, prêmios em Verde Ganancia | `FEATURE_TOURNAMENTS` | **AMARELO:** Inscrições e sincronia |
| **13.6** | **Centro de Notificaciones** | Alertas de payout alto em favoritos e confirmações de saque | `FEATURE_NOTIFICATIONS_CENTER` | **VERDE:** Subscrições WebSocket |

---

## 3. Protocolo de Implementação de Cada Tela Periférica

1. **Isolamento de Flag:** Nenhuma tela periférica é exposta sem que sua flag correspondente esteja explicitamente habilitada.
2. **Preservação de Pagamentos e Ledger (Invariante I-01):**
   - O fluxo de depósito (13.1) atua exclusivamente como camada de UI para invocar o backend já existente.
   - Nenhuma manipulação manual de saldos, taxas de conversão ou valores ocorre no cliente.
3. **Padrão Estético e Design System:**
   - Todas as telas herdam obrigatoriamente os tokens Turbo Prata (`--bm-noche`, `--bm-panel`, `--bm-prata`, `--bm-verde`, `--bm-rojo`, `--bm-aco`, `--bm-blanco`).
   - Fontes: Archivo para títulos e microcopy; Geist Mono para valores, saldos e cronômetros.

---

## 4. Estado da Suíte e Gates de Qualidade

- **Testes Unitários:** 90 testes passando (100% verde).
- **TypeScript & Bundler:** `npm run build --prefix apps/web` compilado com zero erros.
- **Governança:** Conformidade estrita com `AGENTS.md` e regras de zonas sensíveis.
