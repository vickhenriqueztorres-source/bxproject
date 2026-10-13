# PLANO MESTRE — O Modelo Mais Lucrativo para a Corretora (BINMAX)
## Vencimentos Turbo (60s), Fim de Vela (1M com Piso de 30s), Payouts Otimizados e Blindagem de Margem

---

## 1. Visão Executiva e Fundamentos Financeiros

O modelo de maior lucratividade, giro e retenção para uma corretora de opções binárias e derivativos sintéticos baseia-se em quatro pilares matemáticos e operacionais:

1. **Giro Acelerado de Capital (Velocidade do Dinheiro)**:
   - Contratos com duração de **60 segundos** (Turbo fixo) e **Fim de Vela de 1 minuto** (com corte nos 30s) permitem entre **30 e 60 operações por usuário por hora**.
   - O volume transacionado (*turnover*) se multiplica, permitindo que a Lei dos Grandes Números converta a vantagem matemática da casa (*House Edge*) em receita líquida estável.

2. **House Edge Calibrado (Payout de 85%)**:
   - Payout nominal de **85%** oferece percepção de alto ganho ao cliente, enquanto retém uma margem estatística de **7,5%** por giro sobre todo o volume negociado.

3. **Piso Inviolável de Segurança de 30 Segundos (Anti-Arbitragem)**:
   - **Regra dos 30 segundos (Modelo IQ Option)**: Proíbe terminantemente aberturas com menos de 30 segundos de vida.
   - Neutraliza riscos de *clock drift*, oscilações de latência de rede no Brasil/LATAM e ataques de bots de alta frequência (*front-running* em milissegundos).

4. **Teto de Risco Pré-Ordem (Float Cap de 3% no Redis)**:
   - Script Lua atômico impede concentração direcional excessiva por vela, preservando a solvência do livro-razão.

---

## 2. Divisão em Subetapas

| Subetapa | Escopo | Agentes & Skills | Entregáveis |
| :--- | :--- | :--- | :--- |
| **Subetapa 01** | **Backend & Shared**: Schema e Validação com Piso de 30s | `backend-implementation-agent`<br>`financial-correctness-reviewer`<br>`02-financial-invariants`, `08-database-foundation` | `packages/shared`: `OpenContractSchema` suporta `duration_seconds` (30s a 300s).<br>`services/api`: `contract-service.ts` valida o piso mínimo de 30s e programa `expiresAt`. |
| **Subetapa 02** | **Frontend Visual**: Refinamento de Alta Precisão do `ExpiryDropdown` | `chief-visual-director`<br>`surgical-frontend-agent`<br>`12-tokens-binmax`, `21-designer-senior-binmax` | Erradicação de emojis (`🕒`, `▲`, `▼`), aplicação de tokens de superfícies (`#0B0E14`, `#101622`, `#151D2B`, `#1C2738`, `#22C47A`), `PrecisionIcons`. |
| **Subetapa 03** | **Sincronização End-to-End**: Boleta, Gráfico e API de Execução | `surgical-frontend-agent`<br>`backend-implementation-agent`<br>`03-synthetic-market-engine`, `11-chart-trading-tools` | `client.ts` repassa `duration_seconds` validado.<br>`TimeLinesOverlay` e `OrderFlagsOverlay` alinhados com o timestamp oficial do servidor. |
| **Subetapa 04** | **Testes Rigorosos**: Estresse, Caos, Segurança e Risco | `qa-resilience-agent`<br>`financial-correctness-reviewer`<br>`06-testing-quality`, `05-resilience-patterns` | Teste de tentativa de envio de <30s (bloqueio garantido), simulação de clock drift, estresse de 100 ordens simultâneas, verificação de idempotência. |
| **Subetapa 05** | **Deploy & Homologação na VPS**: Atualização Remota e Health Checks | `tech-lead-orchestrator`<br>`07-production-operations` | Build do frontend compilado (`apps/web/dist`), deploy via SSH na VPS (`169.58.159.77`), recarregamento de Nginx/PM2 e smoke tests online. |

---

## 3. Critérios de Homologação e Rastreabilidade

- [ ] Nenhuma alteração nas invariantes contábeis I-01 a I-06 (Blnk Ledger, saldos e dupla entrada intactos).
- [ ] Piso de 30s rigorosamente validado no servidor (qualquer envio de 5s, 10s ou 29s é automaticamente ajustado ou rejeitado).
- [ ] 100% dos testes unitários e de integração existentes mantidos verdes (zero regressões).
- [ ] Visual institucional da boleta 100% aderente à identidade "Instrumento de Precisão" (sem emojis ou cores fluorescentes).
