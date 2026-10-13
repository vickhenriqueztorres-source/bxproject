# SUBETAPA 5: PAINEL ADMIN MULTI-PAÍS & GESTÃO DE FLAGS EM RUNTIME

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `frontend-realtime-agent`  
**Agentes Revisores e Auditores:** `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-05`

---

## 1. Objetivo e Escopo

Desenvolver a interface administrativa centralizada em `apps/admin` para governança operacional e regional dos 6 países na Fase 2, incluindo:
1. **Painel de Controle dos 6 Países**:
   - Visão consolidada de Brasil (`BR`), México (`MX`), Colômbia (`CO`), Argentina (`AR`), Chile (`CL`) e Peru (`PE`).
   - Indicadores visuais de status (Ativo, Em Manutenção, Desativado).
2. **Gerenciador de Feature Flags em Tempo Real**:
   - Toggles (interruptores) dinâmicos para cada país: `is_active`, `trading_enabled`, `otc_real_feed`, `demo_wallet`.
   - Ao alterar um switch, o painel envia requisição autenticada para `PUT /api/v1/admin/countries/:country/flags`, propagando a alteração para o Redis em < 50ms sem necessidade de restart de nenhum container.
3. **Dashboard de Auditoria de Geoblocking**:
   - Tabela de incidentes recentes de requisições bloqueadas por país (ex.: `US`, `FR`, `DE`), exibindo timestamp, país detectado e código de bloqueio com mascaramento de IP para privacidade.
4. **Visão Preparatória de Perfis de KYC**:
   - Listagem dos perfis cadastrados no schema preparatório de KYC com filtro por país (`CPF`, `CURP`, `CC`, `DNI`, `RUT`).
   - Ações demonstrativas de alteração de status (`APPROVED`, `REJECTED`, `PENDING`), comprovando a modelagem da Fase 2 sem impactar a carteira demo.

---

## 2. Invariantes de Segurança e RBAC

- **S-01 / S-02 / S-03 (Proteção Estrita por RBAC)**: O acesso ao painel admin exige token OIDC/JWT emitido pelo Keycloak com a claim de role `ADMIN`. Caso um usuário comum (`USER`) tente carregar o app ou consumir os endpoints administrativos, o sistema emite HTTP 403 e encerra a sessão na UI.
- **Auditoria de Ações**: Toda alteração de feature flag registra log estruturado com o `user_id` do administrador responsável, valor anterior e novo valor.

---

## 3. Estrutura de Telas do Admin

```text
Painel Admin Multi-País
├── [Aba 1] Países & Feature Flags
│   ├── Grid dos 6 países com Bandeira, Nome, Moeda Padrão e Locale
│   └── Matriz de Flags com Toggles reativos (is_active, trading_enabled, etc.)
├── [Aba 2] Auditoria de Geoblocking
│   └── Logs de conexões bloqueadas em tempo real com indicador de origem
└── [Aba 3] Gestão de KYC Preparatório
    └── Lista de usuários com documento regional e status de triagem
```

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`apps/admin/test/admin-country-flags.test.tsx`)
- Renderização do grid dos 6 países com dados mockados.
- Disparo do evento de chaveamento de flag com validação do payload.
- Formatação das datas e máscaras de documentos de cada país.

### 4.2 Testes de Integração (`tests/integration/test-admin-multicountry-flow.test.ts`)
- Fluxo ponta a ponta: login com credencial de admin -> alteração da flag de trading para `MX` -> verificação imediata na API pública de que `MX` agora tem a flag desativada.
- Verificação de barreira de acesso para tokens de perfil não-admin (esperado 403 Forbidden).

### 4.3 Testes de Segurança
- Sanitização de entradas contra injeção de scripts (XSS) nas tabelas do admin.
- Tentativa de falsificação de cabeçalho de role administrativa.

### 4.4 Testes de Estresse
- Renderização contínua de 500 registros de logs de geoblocking e manipulação rápida de flags sem travamento da renderização React (60 FPS mantidos).

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-05`)
A Subetapa 5 é considerada HOMOLOGADA exclusivamente se:
1. O painel admin gerencia os 6 países e reflete as alterações de feature flags em tempo real no backend.
2. A tela de auditoria de geoblocking e a tela preparatória de KYC funcionam perfeitamente.
3. As barreiras de autenticação e RBAC estão 100% ativas e invioláveis.
4. O `security-reviewer` e o `post-implementation-verifier` validam a entrega.
