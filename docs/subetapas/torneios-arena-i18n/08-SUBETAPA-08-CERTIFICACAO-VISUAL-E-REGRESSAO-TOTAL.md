# Subetapa 08 — Certificação Visual, Estresse, Segurança, Caos e Regressão Final

> **Agentes Alocados**: `qa-resilience-agent`, `chief-visual-director`, `security-reviewer`, `financial-correctness-reviewer`, `regression-guardian-agent`, `post-implementation-verifier`
> **Skills**: `02-financial-invariants`, `04-security-iam`, `06-testing-quality`, `10-post-implementation-verification`, `18-zonas-sensiveis`, `19-testes-de-regressao-visual`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — 11 Suítes / 95 Testes Aprovados + Build de Produção Limpo)

---

## 1. Objetivo da Subetapa
Certificar matematicamente e visualmente que todos os problemas apontados nas 3 imagens (`media_1791997457425_55b074dc.png`, `media_1791997476455_140c4a26.png`, `media_1791997512455_2b59159e.png`) foram erradicados sem introduzir regressões:
1. **Zero Botões/Inputs Brancos na Arena**: Verificação automatizada de CSS e classes em `ArenaTicket`, `ArenaRoom` (abas `Ranking | Robô | Extrato`), `Leaderboard` (filtros `Top 5..30`) e `ArenaLobby`.
2. **Zero Colisão na Tabela de Ranking**: Verificação de `whitespace-nowrap` e espaçamento horizontal entre `PONTOS` (`T$ 1.000`) e `PRÊMIO` (`US$ 218,75`).
3. **Zero Descompasso de Idioma (Sidebar ↔ Arena ↔ Torneios)**: Verificação em `I18nProvider` default (sem `initialLocale`), `pt-BR` e `es-ES` garantindo que Sidebar e Arena exibem sempre o mesmo idioma.
4. **Zero Estouro de `100vh` em `/arena`**: Verificação de que `/arena` renderiza sem banner duplicado e com `ArenaBar`, `PriceChart`, `ArenaTicket` e `Leaderboard` encaixados no shell.
5. **Execução de 100% das Suítes + Build de Produção (`vite build`)**.
