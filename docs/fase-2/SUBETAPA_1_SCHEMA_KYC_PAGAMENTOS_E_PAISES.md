# SUBETAPA 1: SCHEMAS DE PAÍSES, FLAGS, KYC & PAGAMENTOS PREPARATÓRIOS

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `financial-correctness-reviewer`, `security-reviewer`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-01`

---

## 1. Objetivo e Escopo

Implementar as migrações no PostgreSQL (`0020_phase2_countries_flags_kyc_payments.sql` e seu correspondente `.down.sql`) para preparar as bases de dados da Fase 2, incluindo:
1. Catálogo oficial dos **6 Países autorizados**: Brasil (`BR`), México (`MX`), Colômbia (`CO`), Argentina (`AR`), Chile (`CL`), Peru (`PE`).
2. Catálogo das **6 Moedas de Exibição**: `BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN` com suas taxas de câmbio nominais em relação a USD e precisões decimais.
3. Tabela de **Feature Flags por País** (`country_feature_flags`) para suporte a comutação dinâmica sem redeploy.
4. Schema preparatório de **KYC Regional** (`kyc_profiles`) com suporte a documentos nativos de cada país (`CPF`, `CURP`, `CC`, `DNI`, `RUT`), garantindo que o status inicial seja `UNVERIFIED` e nenhuma obrigatoriedade bloqueie a carteira demo da Fase 2.
5. Schema preparatório de **Métodos de Pagamento Futuros** (`payment_methods_registry`) registrando os métodos típicos de cada país (`PIX`, `SPEI`, `PSE`, `RAPIPAGO`, `SENCILLITO`, `PAGOEFECTIVO`) estritamente com flag `is_active = FALSE`, sem conexão com PSP e sem tráfego de dinheiro real.
6. Tipagens e validações Zod no pacote `@broker/shared`.

---

## 2. Invariantes e Regras de Segurança Invioláveis

- **I-01 / I-02 (Zero Dinheiro Real)**: O schema NÃO altera as tabelas de contratos ou saldos do Blnk. Nenhuma movimentação de moeda real é permitida. As moedas cadastradas são estritamente de visualização (`display_currencies`).
- **S-03 / S-05 (Menor Privilégio e Grants)**: As novas tabelas devem receber concessões explícitas de `GRANT` para as roles do PostgreSQL (`app_user` para leitura/escrita de rotas normais, `worker_user` onde aplicável). Nenhuma tabela criada pode ter permissão `PUBLIC`.
- **D-05 (Atomicidade da Migração)**: O script SQL deve ser executado sob bloco transacional único (`BEGIN; ... COMMIT;`), com script de reversão (`down.sql`) idempotente e testado.

---

## 3. Especificação do Modelo de Dados (PostgreSQL)

### 3.1 Tabela `countries`
```sql
CREATE TABLE countries (
  code CHAR(2) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  default_currency CHAR(3) NOT NULL,
  default_locale VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
*Seeds iniciais:*
- `'BR'`, `'Brasil'`, `'BRL'`, `'pt-BR'`, `TRUE`
- `'MX'`, `'México'`, `'MXN'`, `'es-MX'`, `TRUE`
- `'CO'`, `'Colômbia'`, `'COP'`, `'es-CO'`, `TRUE`
- `'AR'`, `'Argentina'`, `'ARS'`, `'es-AR'`, `TRUE`
- `'CL'`, `'Chile'`, `'CLP'`, `'es-CL'`, `TRUE`
- `'PE'`, `'Peru'`, `'PEN'`, `'es-PE'`, `TRUE`

### 3.2 Tabela `display_currencies`
```sql
CREATE TABLE display_currencies (
  code CHAR(3) PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(64) NOT NULL,
  decimals INT NOT NULL DEFAULT 2,
  exchange_rate_to_usd NUMERIC(18,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3 Tabela `country_feature_flags`
```sql
CREATE TABLE country_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  flag_key VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_country_flag UNIQUE (country_code, flag_key)
);
CREATE INDEX idx_country_flags_lookup ON country_feature_flags(country_code, flag_key);
```

### 3.4 Tabela Preparatória `kyc_profiles`
```sql
CREATE TABLE kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL UNIQUE,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  document_type VARCHAR(32) NOT NULL,
  document_number VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_kyc_status CHECK (status IN ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED'))
);
CREATE INDEX idx_kyc_user_country ON kyc_profiles(user_id, country_code);
```

### 3.5 Tabela Preparatória `payment_methods_registry`
```sql
CREATE TABLE payment_methods_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  method_code VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_country_method UNIQUE (country_code, method_code)
);
```

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-phase2-schemas.test.ts`)
- Validação Zod dos esquemas de dados de entrada e saída.
- Validação de que códigos de país fora da lista autorizada são rejeitados com erro de validação.
- Validação de que status de KYC inválidos são barrados.

### 4.2 Testes de Integração (`tests/integration/test-phase2-migration.test.ts`)
- Execução da migração `up.sql` em banco real.
- Verificação da integridade referencial (FK de país em flags, kyc e pagamentos).
- Execução da migração `down.sql` e reexecução da `up.sql` comprovando idempotência e ausência de resíduos orfãos.
- Verificação de GRANTs concedidos à role `app_user`.

### 4.3 Testes de Segurança
- Tentativa de injeção de SQL ou payloads maliciosos em colunas `metadata` e `config` (JSONB).
- Verificação de isolamento contra acessos não autenticados no banco de dados.

### 4.4 Testes de Estresse
- Inserção em massa de 5.000 perfis KYC e flags de teste, validando tempos de consulta indexada < 5ms.

### 4.5 Testes de Caos
- Interrupção forçada no meio da transação SQL para comprovação de rollback limpo pelo PostgreSQL sem corrupção de catálogo.

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-01`)
A Subetapa 1 é considerada HOMOLOGADA exclusivamente se:
1. As migrações `.sql` rodam e revertem perfeitamente.
2. Os seeds dos 6 países, 6 moedas e métodos inativos estão gravados.
3. Os contratos do pacote `@broker/shared` estão compilados e exportados.
4. O `post-implementation-verifier` atesta a aprovação de todos os testes sem exceção.
