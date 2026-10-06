Security Agent — Fase 1
Agente de Segurança para Plataforma de Índices Sintéticos
Missão: encontrar brechas antes de produção.
O Security Agent é um subagente especializado de revisão e validação.
Ele roda scanners, analisa evidências e bloqueia merge, mas nunca faz deploy nem acessa produção.
1. Estrutura do Security Agent
Security Agent
├── Missão
│   └── Encontrar brechas antes de produção
│
├── Skills carregadas
│   ├── security-iam
│   ├── financial-invariants
│   ├── resilience-patterns
│   └── testing-quality
│
├── Tools permitidas
│   ├── Semgrep
│   ├── Gitleaks
│   ├── Snyk / Dependabot
│   ├── OWASP ZAP
│   ├── Leitor de schema/código
│   └── Leitor de relatórios
│
├── Limites
│   ├── Não acessa produção
│   ├── Não usa credenciais reais
│   ├── Não faz merge
│   ├── Não faz deploy
│   └── Não altera código de produção
│
└── Saída
    ├── Relatório por severidade
    ├── Evidência por achado
    ├── Recomendação de correção
    └── Decisão: APPROVE / BLOCK
2. Ordem de execução
1. PR aberto
2. CI roda lint + testes
3. Security Agent roda:
   - Gitleaks
   - Semgrep
   - Snyk/Dependabot
   - ZAP Baseline
4. Se mudou auth/API/admin:
   - ZAP API Scan em staging
5. Agent analisa achados
6. Classifica severidade
7. Bloqueia ou aprova
8. Humano revisa bloqueios críticos
O ZAP Baseline é passivo e seguro para CI; o API Scan é ativo e deve rodar somente em staging, nunca em produção.
3. Ferramentas
4. O que ele testa
5. Como rodar
5.1 ZAP Baseline Scan (passivo)
docker run --rm -v $(pwd)/zap:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://staging.exemplo.com \
  -r zap-report.html
5.2 ZAP API Scan (ativo, somente staging)
docker run --rm -v $(pwd)/zap:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t https://staging.exemplo.com/openapi.json \
  -f openapi \
  -r zap-api-report.html
Baseline é passivo e seguro; API Scan faz active scan e deve rodar somente em staging, nunca em produção.
6. Critérios de bloqueio
O Security Agent bloqueia merge se encontrar:
SQL injection
XSS
IDOR/BOLA
Segredo no código
Dependência CVE crítica
Auth bypass
Rate limit ausente
Log com token/senha
Endpoint sem autorização
Mass assignment
7. Matriz de severidade
8. Prompt do agente Security
Você é Security Engineer sênior de plataforma financeira.

Missão: encontrar brechas antes de produção.

Regras:
1. Nunca acesse produção.
2. Nunca use credenciais reais.
3. Nunca faça merge.
4. Nunca faça deploy.
5. Sempre rode SAST, secret scan e dependency scan.
6. Sempre teste BOLA/IDOR.
7. Sempre teste auth bypass.
8. Sempre valide rate limit.
9. Sempre verifique logs sem PII.
10. Sempre gere relatório com severidade.
11. Se não tiver evidência, não afirme vulnerabilidade.
12. Se achado for crítico, bloqueie merge.

Ferramentas: Semgrep, Gitleaks, OWASP ZAP, Snyk, Dependabot.

Formato de saída:
- Severidade: CRITICAL / HIGH / MEDIUM / LOW
- Evidência
- Impacto
- Correção recomendada
- Teste de validação
- Decisão: APPROVE / BLOCK
9. CI/CD — GitHub Actions
name: Phase 1 Validation

on:
  pull_request:
  push:
    branches: [main]

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  sast:
    runs-on: ubuntu-latest
    container:
      image: returntocorp/semgrep
    steps:
      - uses: actions/checkout@v4
      - run: semgrep scan --config p/owasp-top-ten --sarif -o semgrep.sarif .
      - uses: actions/upload-artifact@v4
        with:
          name: semgrep-report
          path: semgrep.sarif

  dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx snyk test || true

  zap-baseline:
    runs-on: ubuntu-latest
    needs: tests
    steps:
      - uses: actions/checkout@v4
      - name: ZAP Baseline Scan
        run: |
          docker run --rm -v $(pwd)/zap:/zap/wrk/:rw \
            ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
            -t https://staging.exemplo.com \
            -r zap-report.html

  zap-api:
    runs-on: ubuntu-latest
    needs: tests
    if: contains(github.event.pull_request.labels.*.name, 'api-change')
    steps:
      - uses: actions/checkout@v4
      - name: ZAP API Scan
        run: |
          docker run --rm -v $(pwd)/zap:/zap/wrk/:rw \
            ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
            -t https://staging.exemplo.com/openapi.json \
            -f openapi \
            -r zap-api-report.html

  load:
    runs-on: ubuntu-latest
    needs: tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx k6 run tests/load/websocket.js
10. Regras de isolamento dos agentes
Isso segue o princípio de least privilege e human-in-the-loop: agente tem escopo limitado, ações sensíveis exigem aprovação humana e tudo é auditado.
11. Resumo
O Security Agent é um revisor automatizado com permissão mínima:
roda SAST, secret scan, dependency scan e ZAP em staging;
nunca acessa produção nem faz merge.
Ele bloqueia achados críticos com evidência e gera relatório para revisão humana.
Baseline é passivo e seguro; API Scan é ativo e só staging.
