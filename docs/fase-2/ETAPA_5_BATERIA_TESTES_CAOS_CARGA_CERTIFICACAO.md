# SUBETAPA 5: BATERIA COMPLETA DE TESTES, CARGA, CAOS E CERTIFICAÇÃO FINAL

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `qa-resilience-agent`  
**Agentes Revisores e Auditores:** `security-reviewer`, `financial-correctness-reviewer`, `broker-architect-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-FINAL`  

---

## 1. Objetivo e Especificação Técnica

Executar a bateria unificada de testes de certificação da Fase 2, comprovando formalmente o atendimento aos 8 critérios de pronto exigidos pelo usuário:

1. **Validação dos 6 Países**: Teste E2E cobrindo requisições originadas de `BR`, `MX`, `CO`, `AR`, `CL`, `PE`.
2. **Validação dos Idiomas e Namespaces**: Teste de paridade 100% cobrindo os 5 namespaces nos 6 diretórios regionais.
3. **Validação das 6 Moedas**: Conversão determinística e formatação `Intl.NumberFormat` com precisão decimal adequada para `BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN`.
4. **Validação do OTC Demo com Feed Real**: Verificação da pipeline `Provedor` → `Normalizer` → `Guard` → `Postgres` → `Redis` → `WebSocket` com cálculo do hash SHA-256 inquebrável.
5. **Validação de Geoblocking**: Bloqueio de 100% das origens não autorizadas com código 403 `GEO_BLOCKED` e tela de bloqueio.
6. **Validação de Feature Flags Dinâmicas**: Comutação em runtime das 10 feature flags sem necessidade de deploy.
7. **Testes de Caos**:
   - Derrubada forçada de Redis: fallback automático para PostgreSQL.
   - Perda de conexão com provedores externos de cotação: abertura imediata do Circuit Breaker e ativação do fallback estocástico Ornstein-Uhlenbeck sem perder emissão de ticks.
   - Flap de feature flags em rajadas sem corrupção de estado.
8. **Testes de Carga k6**:
   - 1.000 Usuários Virtuais (VUs) simultâneos simulando tráfego dos 6 países.
   - Latência p95 < 50ms na API de geolocalização e flags.
   - Zero erros 5xx.

---

## 2. Roteiro de Execução da Certificação

1. **Passo 5.1**: Execução da suíte completa de testes unitários (`npm run test:unit` ou `npx vitest run tests/unit`).
2. **Passo 5.2**: Execução dos testes de integração multi-região (`npx vitest run tests/integration`).
3. **Passo 5.3**: Execução dos testes de caos (`npx vitest run tests/chaos`).
4. **Passo 5.4**: Execução do script unificado de certificação forense pós-implementação (`tests/test-phase2-final-certification.mjs`).
5. **Passo 5.5**: Emissão do Relatório Final de Homologação da Fase 2 assinado pelos auditores.

---

## 3. Critério de Aceite Final (`GATE-F2-FINAL`)
A Fase 2 só é declarada concluída se:
- Todos os testes automatizados executam e passam com código 0.
- Nenhuma invariante contábil ou de segurança é violada.
- O auditor independente `post-implementation-verifier` emite veredito de aprovação irrestrita.
