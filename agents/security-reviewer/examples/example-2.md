# Example 2 — T01/T02 Compose e realm com segredo e client permissivo

Revisão de configuração, não de código de aplicação. Mostra como reportar segredo sem reproduzir o
valor, como exigir rotação e como registrar valores que ainda não foram decididos.

## Handoff recebido

```yaml
task_id: T02
agent: security-reviewer
objective: Revisar o realm exportado e o Compose que sobe o Keycloak.
context:
  - diff: infra/keycloak/realm-synth.json
  - diff: infra/docker-compose.yml
  - nota do backend: "senha do admin no compose só pra dev, depois a gente troca"
skills: [01-project-context, 04-security-iam, 07-production-operations]
acceptance_criteria:
  - Client do front usa Authorization Code + PKCE S256, sem implicit nem password grant.
  - Brute force 5 tentativas / 15 min.
  - Nenhum segredo literal versionado.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

## Configuração revisada (valores mascarados pelo revisor)

```json
// infra/keycloak/realm-synth.json
41  "clientId": "synth-web",
42  "publicClient": true,
43  "standardFlowEnabled": true,
44  "implicitFlowEnabled": false,
45  "directAccessGrantsEnabled": true,
46  "redirectUris": ["https://app.synth.local/*", "*"],
47  "attributes": { "pkce.code.challenge.method": "S256" },
...
88  "bruteForceProtected": true, "failureFactor": 5, "maxDeltaTimeSeconds": 900,
```

```yaml
# infra/docker-compose.yml
12  keycloak:
13    environment:
14      KEYCLOAK_ADMIN: admin
15      KEYCLOAK_ADMIN_PASSWORD: ****            # valor literal no arquivo — mascarado no relatório
...
40  postgres:
41    ports: ["5432:5432"]
```

## Saída

```yaml
task_id: T02
agent: security-reviewer
status: DONE
summary: >
  Revisão do realm synth e do Compose do Keycloak. REPROVADO. PKCE S256 e brute force corretos;
  implicit desligado. Porém o client público synth-web aceita password grant e redirect "*", a
  senha do admin do Keycloak está literal no Compose (rotação obrigatória) e o Postgres publica a
  porta 5432 no host. TTL do access token e gerenciador de segredos seguem não decididos.
artifacts: []
evidence:
  - infra/keycloak/realm-synth.json:41-47,88 lido
  - infra/docker-compose.yml:12-15,40-41 lido
  - bash agents/security-reviewer/scripts/health-check.sh → FAIL "directAccessGrantsEnabled"; FAIL "redirectUris *"; FAIL "senha literal (mascarada)"
  - git ls-files | grep '\.env$' → nenhum .env versionado
acceptance_criteria_met:
  - { criterion: "Code + PKCE S256, sem implicit nem password grant", met: false, evidence: "S-01 realm-synth.json:45" }
  - { criterion: "Brute force 5 / 15 min", met: true, evidence: "realm-synth.json:88" }
  - { criterion: "Nenhum segredo literal versionado", met: false, evidence: "S-06 docker-compose.yml:15" }
confidence_score: 0.92
review:
  surface: [client synth-web, realm synth, serviço keycloak, serviço postgres, portas publicadas]
  controls:
    S-01: { result: FAIL, evidence: "realm-synth.json:45 directAccessGrantsEnabled; :46 redirect '*'" }
    S-02: { result: N/A, evidence: "T02 não implementa validação de token (T03)" }
    S-03: { result: PASS, evidence: "roles USER, AUDITOR, ADMIN no realm; MFA required action para ADMIN/AUDITOR" }
    S-04: { result: N/A, evidence: "sem acesso a recurso de usuário" }
    S-05: { result: N/A, evidence: "sem DTO" }
    S-06: { result: FAIL, evidence: "docker-compose.yml:15 senha literal" }
  findings:
    - severity: CRÍTICO
      location: infra/docker-compose.yml:15
      problem: senha do usuário admin do Keycloak em texto puro no arquivo versionado
      vector: quem lê o repositório entra no console admin do Keycloak e emite tokens ADMIN para qualquer conta
      violates: [S-06, SR-06]
    - severity: CRÍTICO
      location: infra/keycloak/realm-synth.json:46
      problem: redirect URI curinga no client público
      vector: atacante monta link de login com redirect_uri para domínio próprio e recebe o authorization code da vítima
      violates: [S-01]
    - severity: ALTO
      location: infra/keycloak/realm-synth.json:45
      problem: password grant ligado no client público
      vector: script de força bruta usa o token endpoint direto, contornando a tela de login e o MFA
      violates: [S-01]
    - severity: ALTO
      location: infra/docker-compose.yml:41
      problem: Postgres publica 5432 no host
      vector: em staging com host acessível, conexão direta ao banco contorna API, RBAC e auditoria
      violates: [S-06]
  rotations_required:
    - "senha do usuário admin do Keycloak (infra/docker-compose.yml:15) — rotacionar antes de limpar o histórico"
  verdict: REPROVADO
decisions_cited: [D-01, S-01, S-03, S-06, SR-06, SR-12, B-13]
pending:
  - TTL do access token <não definido no contexto> (recomendação ≤ 5 min)
  - Gerenciador de segredos em staging/prod <não definido no contexto>
handoff_notes:
  - "qa-resilience-agent: O-01 healthcheck ausente no serviço keycloak (docker-compose.yml:12) — fora do domínio de segurança"
```

## Sobre "é só pra dev"

A nota do backend não muda a classificação: o arquivo está versionado e o mesmo Compose sobe staging (O-01).
O relatório registra a nota em `summary` só se ela mudar algo; aqui não muda.

## O que o revisor não fez

- Não copiou a senha, nem parte dela, nem o tamanho.
- Não entrou no console do Keycloak com a senha encontrada para "provar" o achado.
- Não escreveu o bloco `secrets:` corrigido do Compose.
