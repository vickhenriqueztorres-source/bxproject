# SUBETAPA 8: BATERIA COMPLETA DE CARGA k6, CAOS E CERTIFICAÇÃO FINAL

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agentes Executores:** `qa-resilience-agent`, `broker-architect-agent`  
**Agentes Revisores e Auditores:** `financial-correctness-reviewer`, `security-reviewer`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-FINAL`

---

## 1. Objetivo e Escopo

Executar a bateria formal e definitiva de homologação da **Fase 2**, comprovando por execução prática todos os requisitos do **Critério de Pronto**:
1. **6 Países**: Usuários de Brasil, México, Colômbia, Argentina, Chile e Peru operam concorrentemente.
2. **2 Idiomas**: Alternância fluida e validação de textos completos em Português e Espanhol.
3. **6 Moedas**: Exibição e conversão matemática correta para BRL, MXN, COP, ARS, CLP e PEN, sem impactar o ledger.
4. **OTC Demo com Feed Real**: Continuidade e acurácia dos pares `BTCUSD_OTC`, `ETHUSD_OTC`, `EURUSD_OTC` e `XAUUSD_OTC`.
5. **Geoblocking Inviolável**: 100% de bloqueio com HTTP 403 para origens não permitidas.
6. **Feature Flags Dinâmicas**: Desativação e reativação de países e recursos em tempo real sem redeploy.
7. **Zero Dinheiro Real**: Auditoria formal do Blnk Ledger comprovando isolamento 100% demo.
8. **Testes de Carga e Caos Aprovados**: Tolerância a picos de tráfego e resiliência a partições de rede.

---

## 2. Roteiro da Bateria de Testes

### 2.1 Teste de Integração Ponta a Ponta (`tests/integration/test-phase2-e2e.test.ts`)
- Simulação de ciclo de vida completo de 6 usuários (um em cada país autorizado):
  - Detecção geográfica correta.
  - Carregamento de interface no idioma local.
  - Visualização de saldo demo na moeda local.
  - Abertura de contrato UP/DOWN no par OTC real `BTCUSD_OTC` e no índice sintético nativo.
  - Settlement do contrato com crédito no Blnk ledger em `USD_minor`.
- Simulação de 1 usuário de país não autorizado (`US`):
  - Interceptação com HTTP 403 `GEO_BLOCKED`.
- Desativação do país `CL` via feature flag:
  - Verificação imediata de bloqueio para usuários chilenos.
  - Reativação imediata da flag e restauração do serviço.

### 2.2 Teste de Carga e Estresse k6 (`tests/load/phase2-multicountry-ramp.k6.js`)
- **Cenário**: Ramp-up de 0 a 1.000 usuários simultâneos gerando tráfego misto dos 6 países e origens bloqueadas:
  - 80% tráfego dos 6 países autorizados distribuídos proporcionalmente.
  - 20% tráfego de países não permitidos para estressar o motor de geoblocking.
- **Métricas de Aceite (SLO)**:
  - Taxa de sucesso para requisições autorizadas > 99.9%.
  - Taxa de acerto de bloqueio para requisições não autorizadas = 100%.
  - Latência de resolução geográfica p95 < 15ms.
  - Latência de abertura de contrato p99 < 150ms.

### 2.3 Bateria de Injeção de Caos (`tests/chaos/phase2-chaos-scenarios.test.ts`)
1. **Caos C-F2-01: Queda do Feed Real de Mercado**:
   - Forçar queda da conexão com dados reais de `ETHUSD_OTC`.
   - Verificar acionamento imediato do fallback Ornstein-Uhlenbeck sem falha de tick (continuidade estrita de timestamps e sequence).
2. **Caos C-F2-02: Queda do Cache Redis de Flags**:
   - Forçar interrupção do Redis.
   - Verificar que o Geoblocking recorre com segurança ao PostgreSQL sem deixar vazar nenhum tráfego proibido.
3. **Caos C-F2-03: Storm de IP Spoofing**:
   - Enviar 5.000 requisições simultâneas forjando cabeçalhos `X-Forwarded-For` de países autorizados sem passar por proxy confiável.
   - O sistema deve rejeitar 100% dos bypasses.

---

## 3. Checklist de Auditoria Forense (`post-implementation-verifier`)

| Item de Verificação | Requisito Formal | Evidência de Execução | Veredito |
| :---: | :--- | :--- | :---: |
| **V-F2-01** | 6 Países acessam e operam normalmente | E2E Suite `test-phase2-e2e.test.ts` | 🟢 / 🔴 |
| **V-F2-02** | 2 Idiomas traduzem 100% sem chaves órfãs | i18n Suite `i18n-currency.test.tsx` | 🟢 / 🔴 |
| **V-F2-03** | 6 Moedas formatadas com integridade USD | Currency Suite `test-currency-formatting.test.ts` | 🟢 / 🔴 |
| **V-F2-04** | Feeds OTC reais ativos com fallback seguro | Pipeline Suite `test-real-feed-pipeline.test.ts` | 🟢 / 🔴 |
| **V-F2-05** | Geoblocking bloqueia 100% origens não permitidas | Geoblock Suite `test-geoblock-api.test.ts` | 🟢 / 🔴 |
| **V-F2-06** | Feature flags ligam/desligam país em runtime | Admin Suite `test-admin-multicountry-flow.test.ts` | 🟢 / 🔴 |
| **V-F2-07** | Zero dinheiro real circula no Blnk | Ledger Audit `blnk-accounting-audit.test.ts` | 🟢 / 🔴 |
| **V-F2-08** | Bateria de carga k6 e cenários de caos aprovados | Load & Chaos Suites | 🟢 / 🔴 |

---

## 4. Quality Gate e Homologação Final (`GATE-F2-FINAL`)
A Fase 2 será formalmente homologada e declarada **PRONTA** quando o relatório de auditoria do `post-implementation-verifier` confirmar 100% dos itens da tabela com veredito verde.
