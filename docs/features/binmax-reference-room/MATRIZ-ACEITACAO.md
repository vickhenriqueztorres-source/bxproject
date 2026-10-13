# Matriz de Aceitação e Rastreabilidade — Binmax Reference Room

**Data de Conclusão:** 2026-10-09  
**Status Consolidado:** **100% HOMOLOGADO E CONCLUÍDO**

---

## 1. Rastreabilidade das 10 Subetapas / 12 Sessões Visuais

| ID | Garantia / Escopo | Sessão de Design | Status | Evidência de Execução |
|---|---|---|---|---|
| **AC-BMR-01** | Shell Desktop 5 Regiões, Tokens Turbo Prata, Archivo + Geist Mono | Sessão 1 | **APROVADO** | `subetapa-01-shell-layout.unit.test.tsx` (5/5) · `RELATORIO-SUBETAPA-01.md` |
| **AC-BMR-02** | Seletor de Ativos (36 Ativos), Busca, Categorias e Abas com Bandeiras | Sessão 2 | **APROVADO** | `asset-catalog-modal.unit.test.tsx` (8/8), `subetapa-02-header-fidelity.unit.test.tsx` (4/4) · `RELATORIO-SUBETAPA-02.md` |
| **AC-BMR-03** | Flag de Ordem no Gráfico, TradersMoodBar, Linhas de Compra/Expiração | Sessão 3 | **APROVADO** | `subetapa-04-chart-overlays.unit.test.tsx` (5/5) · `RELATORIO-SUBETAPA-03.md` |
| **AC-BMR-04** | Boleta Ergonômica 150px, Botões SUBE/BAJA, Toasts Ganaste/Perdiste | Sessão 4 | **APROVADO** | `trade-result-toast.unit.test.tsx` (3/3), `ticket-ergonomic.unit.test.tsx` (13/13) · `RELATORIO-SUBETAPA-04.md` |
| **AC-BMR-05** | Gaveta Portafolio (Ativo e Vazio com Pasta) e Histórico com Filtros e Hoy | Sessões 5, 5b, 6 | **APROVADO** | `subetapa-05-portfolio-history-drawers.unit.test.tsx` (4/4) · `RELATORIO-SUBETAPA-05.md` |
| **AC-BMR-06** | Seletor Demo/Real ($9.603,75) e Modal Depósito PIX/Tarjeta/USDT | Sessões 8, 9 | **APROVADO** | `subetapa-06-account-deposit.unit.test.tsx` (5/5) · `RELATORIO-SUBETAPA-06.md` |
| **AC-BMR-07** | Gaveta de Torneios Turbo Sprint (Ao Vivo) e Torneio Semanal | Sessão 7 | **APROVADO** | `subetapa-07-tournaments-drawer.unit.test.tsx` (6/6) · `RELATORIO-SUBETAPA-07.md` |
| **AC-BMR-08** | Resiliência, Radar Pulsante "Reconectando..." e Bloqueio Operacional | Sessão 10 | **APROVADO** | `subetapa-08-reconnecting-overlay.unit.test.tsx` (5/5) · `RELATORIO-SUBETAPA-08.md` |
| **AC-BMR-09** | Responsividade Mobile (<768px), Bottom Nav Touch (WCAG AA ≥ 44px) | Sessão 11 | **APROVADO** | `subetapa-09-mobile-layout.unit.test.tsx` (3/3) · `RELATORIO-SUBETAPA-09.md` |
| **AC-BMR-10** | Onboarding Coachmarks de 3 Passos (Investimento, Ativo, Decisão) | Sessão 12 | **APROVADO** | `subetapa-10-onboarding.unit.test.tsx` (6/6) · `RELATORIO-SUBETAPA-10.md` |

---

## 2. Garantias Transversais e Invariantes

- **Invariante Financeiro (I-01 a I-06)**: Minor units estritos (`stake_minor`, `payout_minor`, `available_minor`). Proibido ponto flutuante em saldo e cálculo de payout.
- **Segurança (S-01 a S-06)**: Proteção contra manipulação local, bloqueio imediato de ordens durante desconexão ou cotação congelada (`stale`).
- **Acessibilidade Touch**: Todos os alvos de clique e botões de navegação móvel possuem dimensões superiores a 44x44px.
- **Zero Regressão**: 469/469 testes do monorepo aprovados (100% verde) e zero erros de tipagem TypeScript.
