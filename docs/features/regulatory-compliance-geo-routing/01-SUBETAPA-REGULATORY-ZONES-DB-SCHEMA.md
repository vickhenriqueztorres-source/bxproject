# SUBETAPA 1: SCHEMAS DE ZONAS REGULATÓRIAS, DOMÍNIOS ESPELHO & KYC TIERS

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `financial-correctness-reviewer`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-REG-01`

---

## 1. Objetivo e Escopo

Implementar a camada estrutural de dados no PostgreSQL e no pacote `@broker/shared`:
1. **Catálogo de Zonas Regulatórias (`regulatory_zones`)**:
   - `RED`: Proibição total de oferta retail (Estados Unidos, Canadá, União Europeia, Reino Unido, Austrália, Israel, Japão). Hard block obrigatório.
   - `YELLOW`: Proibição de captação ativa com Reverse Solicitation operante (Brasil, México, Índia, Indonésia, Tailândia, África do Sul, Nigéria, Turquia, Filipinas). Roteamento por espelhos e PSPs locais.
   - `GREEN`: Jurisdições de tolerância total e sedes de licenciamento offshore (Comores, São Vicente e Granadinas, Seychelles, Vanuatu, Ilhas Marshall, Costa Rica, Santa Lúcia, etc.).
2. **Catálogo de Domínios Espelho (`mirror_domains`)**:
   - Rastreamento de domínios ativos, reservas e bloqueados: `domain_name`, `target_country` (opcional/nulo para global), `status` (`ACTIVE`, `STANDBY`, `BLOCKED`, `DEAD`), `priority`, `latency_ms`, `last_health_check_at`.
3. **Evolução do Schema de KYC em Camadas (`kyc_profiles`)**:
   - Campos `tier` (`TIER_0`, `TIER_1`), `deposit_limit_minor` (default 30.000 centavos = $300 para Tier 0, 1.000.000 centavos = $10.000 para Tier 1), `nationality_country_code`, `rejection_reason`.
   - Restrição estrita: Nacionalidades de Zona Vermelha NUNCA podem ser aprovadas em nenhum tier.
4. **Tipagens Zod e DTOs correspondentes** em `packages/shared/src/types.ts`.

---

## 2. Passo a Passo de Implementação

### 2.1 Migração PostgreSQL (`db/migrations/0030_regulatory_zones_mirrors_kyc_tiers.sql`)
1. Criar tipo enum `regulatory_zone_type` (`RED`, `YELLOW`, `GREEN`).
2. Criar tabela `regulatory_jurisdictions`:
   - `country_code` CHAR(2) PRIMARY KEY
   - `country_name` VARCHAR(64) NOT NULL
   - `zone` regulatory_zone_type NOT NULL
   - `regulator_authority` VARCHAR(64) NOT NULL
   - `enforcement_level` VARCHAR(32) NOT NULL
   - `hard_block` BOOLEAN NOT NULL DEFAULT FALSE
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
3. Criar tabela `mirror_domains`:
   - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - `domain_name` VARCHAR(255) NOT NULL UNIQUE
   - `target_country` CHAR(2) REFERENCES regulatory_jurisdictions(country_code) NULL
   - `status` VARCHAR(32) NOT NULL DEFAULT 'STANDBY'
   - `priority` INT NOT NULL DEFAULT 100
   - `latency_ms` INT DEFAULT 0
   - `last_health_check_at` TIMESTAMPTZ DEFAULT NOW()
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
   - `updated_at` TIMESTAMPTZ DEFAULT NOW()
4. Evoluir `kyc_profiles` com:
   - `tier` VARCHAR(16) NOT NULL DEFAULT 'TIER_0'
   - `deposit_limit_minor` BIGINT NOT NULL DEFAULT 30000
   - `nationality_country_code` CHAR(2) NULL
   - `rejection_reason` TEXT NULL
   - Constraint de verificação: `CHECK (tier IN ('TIER_0', 'TIER_1'))`
5. Inserir Seeds Oficiais:
   - **RED**: US (CFTC/SEC), CA (CSA), GB (FCA), AU (ASIC), IL (ISA), JP (JFSA), DE (BaFin), FR (AMF), IT (CONSOB), ES (CNMV), etc. (todos com `hard_block = TRUE`).
   - **YELLOW**: BR (CVM), MX (CNBV), IN (SEBI), ID (Bappebti), TH (SEC), ZA (FSCA), NG (SEC), TR (CMB), PH (SEC).
   - **GREEN**: KM (Mwali/Anjouan), VC (SVGFSA), SC (FSA), VU (VFSC), MH (Marshall Islands), CR (Costa Rica), LC (Santa Lúcia), etc.
   - **Espelhos Iniciais**:
     - `app.nomedominio-br1.com` (BR - ACTIVE)
     - `app.nomedominio-br2.com` (BR - STANDBY)
     - `app.nomedominio-in.com` (IN - ACTIVE)
     - `app.nomedominio-in2.com` (IN - STANDBY)
     - `app.nomedominio-global.com` (GLOBAL / GREEN - ACTIVE)
6. Conceder Grants de menor privilégio para `app_contract` e `app_reader`.

### 2.2 Reversão Idempotente (`0030_regulatory_zones_mirrors_kyc_tiers.down.sql`)
- Remoção controlada das tabelas e tipos criados.

### 2.3 Atualização dos Schemas Zod no `@broker/shared`
- `RegulatoryZoneSchema`, `MirrorDomainSchema`, `KYCTierSchema`.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários e de Schema
- Validar integridade dos seeds de jurisdição: confirmação de que todos os países da Zona Vermelha possuem `hard_block = TRUE` e `zone = 'RED'`.
- Validar parsing dos schemas Zod para dados válidos e rejeição de payloads com campos adulterados.

### 3.2 Testes de Segurança (Security Reviewer)
- **S-01 / Menor Privilégio**: Testar que conexões sem privilégio administrativo não conseguem executar `DROP` ou `ALTER` nas tabelas regulatórias.
- **S-02 / Integridade de Enum**: Tentar inserir zona inexistente (`PURPLE`) e comprovar erro de constraint.
- **S-03 / Invariante Anti-Red Zone**: Comprovar que a constraint impede aprovação de KYC para `nationality_country_code IN ('US', 'GB', 'CA', ...)`.

### 3.3 Testes de Estresse
- Carga de 10.000 consultas diretas ao catálogo de jurisdições e domínios espelhos em < 500ms usando pool de conexões do pg.

### 3.4 Testes de Caos
- Simulação de rollback da migração (`down.sql`) seguido de re-execução (`up.sql`) para garantir idempotência sem perda de estado inconsistente.

---

## 4. Critérios de Aceite para Fechamento do Gate (GATE-REG-01)
1. [ ] Script `0030_regulatory_zones_mirrors_kyc_tiers.up.sql` executado com 100% de sucesso no banco de dados.
2. [ ] Todas as 3 zonas regulatórias (RED, YELLOW, GREEN) devidamente populadas com seus respectivos órgãos reguladores.
3. [ ] Domínios espelho provisionados em `mirror_domains` para Brasil, Índia e Global.
4. [ ] `kyc_profiles` suporta `tier` (`TIER_0`, `TIER_1`) e limites de depósito.
5. [ ] Script de teste `tests/test-reg-subetapa-1-db-seed.mjs` executado e aprovado com código 0.
