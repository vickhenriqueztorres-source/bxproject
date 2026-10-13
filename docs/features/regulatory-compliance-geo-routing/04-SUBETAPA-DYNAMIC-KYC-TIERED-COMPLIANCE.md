# SUBETAPA 4: CAMADA DE KYC DINÂMICO & COMPLIANCE EM TIERS COM ANTI-RED ZONE

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `financial-correctness-reviewer`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-REG-04`

---

## 1. Objetivo e Escopo

Construir o motor de **KYC Dinâmico em Camadas (Tiered Compliance Engine)** com regra de corte inviolável de **Anti-Red Zone Exclusion**:
1. **Tier 0 (Onboarding Ágil & Depósito Baixo sem Documento Físico)**:
   - Exigências: Apenas e-mail e telefone verificados (já providos na conta básica do Keycloak).
   - Teto Financeiro: Limite cumulativo de depósito entre $100 e $300 (ex.: $300 = 30.000 centavos USD) via métodos rápidos (PIX ou cripto).
   - Validação de Segurança: Bloqueio estrito se o IP de cadastro ou conexão for identificado como Zona Vermelha.
2. **Tier 1 (Verificação de Documento de Identidade com Exclusão Absoluta de Zona Vermelha)**:
   - Exigências: Submissão de documento oficial de identidade (Passaporte, RG/CNH no Brasil, INE/CURP no México, DNI, etc.).
   - Motor de Análise Automatizada (Engine / Sumsub Mock):
     - Extrai nacionalidade e país emissor do documento.
     - **Regra Inviolável de Anti-Red Zone**: Se a nacionalidade ou país de residência for Zona Vermelha (`US`, `CA`, `GB`, `AU`, `IL`, `JP` ou países membros da União Europeia), a verificação é **REJEITADA SUMARIAMENTE**, o perfil é marcado como `REJECTED`, a conta é bloqueada para trading e nenhuma movimentação é permitida.
     - Se o documento pertencer a Zona Amarela ou Verde (ex.: `BR`, `MX`, `CO`, `AR`, etc.), o perfil avança para `APPROVED` e o teto operacional é elevado para Tier 1 (ex.: $10.000 USD).
3. **Validação Pré-Depósito e Pré-Ordem**:
   - O serviço de conformidade valida se o usuário possui saldo e se o limite cumulativo do seu Tier não foi violado.

---

## 2. Passo a Passo de Implementação

### 2.1 Serviço de Compliance Dinâmico (`services/api/src/services/compliance-kyc.ts`)
- `getProfileStatus(userId: string): Promise<KYCProfile>`: obtém o status e tier atual do usuário.
- `evaluateTier0Eligibility(userId: string, requestedDepositMinor: number, countryCode: string): Promise<{ allowed: boolean; reason?: string }>`:
  - Valida se o país não é Zona Vermelha.
  - Valida se o total depositado + requerido <= limite de Tier 0 ($300).
- `submitTier1Document(userId: string, data: SubmitDocumentDTO): Promise<KYCEvaluationResult>`:
  - Verifica nacionalidade contra catálogo de Zonas Regulatórias.
  - Se `nationalityZone === 'RED'`, rejeita com `REASON_RED_ZONE_PROHIBITED` e atualiza status para `REJECTED`.
  - Se `nationalityZone === 'YELLOW' | 'GREEN'`, valida documento (formato, checksum básico ou mock de IA) e aprova elevando para `TIER_1` com limite expandido.

### 2.2 Rotas de KYC e Compliance (`services/api/src/routes/kyc.ts`)
- `GET /api/v1/kyc/me`: retorna o status de conformidade do usuário logado, tier atual, limites restantes e exigências pendentes.
- `POST /api/v1/kyc/submit-tier1`: submissão de dados de documento pelo usuário autenticado.
- `POST /api/v1/kyc/pre-deposit-check`: verificação de conformidade pré-depósito chamada pelo subsistema de pagamentos.

### 2.3 Integração com Validação de Contratos e Depósitos
- Interceptar tentativas de abertura de ordem ou depósito se o usuário estiver em estado `REJECTED` por tentativa de fraude de Zona Vermelha.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários de Regras de Tier
- Usuário em Tier 0 pode realizar depósito de $50, $100, até o limite cumulativo de $300.
- Tentativa de depósito de $350 em Tier 0 deve ser bloqueada com código `TIER_LIMIT_EXCEEDED` orientando o upgrade para Tier 1.
- Documento brasileiro (`BR`) ou mexicano (`MX`) submetido deve ser aprovado para Tier 1.

### 3.2 Testes de Segurança (Security Reviewer)
- **Tentativa de Infiltração por Cidadão Americano / Europeu**:
  - Submeter documento com nacionalidade `US` (Passaporte americano) ou `DE` (ID alemão).
  - O sistema DEVE rejeitar com `403` / `STATUS_REJECTED` e registrar auditoria de compliance.
  - Tentativa subsequente de trading deve ser travada.
- **Anti-IDOR / Anti-BOLA**: Garantir que um usuário não consiga submeter documentos ou consultar o perfil KYC de outro usuário.

### 3.3 Testes de Estresse
- Processar 1.000 submissões simultâneas de checagem de Tier com tempo de resposta < 5ms por validação.

### 3.4 Testes de Caos
- Simular indisponibilidade temporária de serviço externo de IA (Veriff/Sumsub): o sistema entra em modo de contingência `PENDING` para análise assíncrona sem travar os depósitos Tier 0 já liberados.

---

## 4. Critérios de Aceite para Fechamento do Gate (GATE-REG-04)
1. [ ] Tier 0 permite depósitos rápidos até $300 sem exigência de documento físico.
2. [ ] Tier 1 rejeita 100% de documentos com nacionalidade de Zona Vermelha.
3. [ ] Tier 1 aprova documentos válidos de Zonas Amarela e Verde elevando o teto operacional.
4. [ ] Invariantes financeiras I-01 a I-06 preservadas (limites validados em `minor` units).
5. [ ] Script de teste `tests/test-reg-subetapa-4-tiered-kyc.mjs` executado com 100% de aprovação.
