# Expected output 1

## Deve conter

- Status para as 6 regras
- `FAIL` em O-01, O-02 e O-06
- `N/A` em O-03, O-04 e O-05
- Causa dos contratos presos em `CREATED`: Redis sem persistência perdeu `wallet:commands` pendentes
- Encaminhamento da credencial literal para `04-security-iam`
- Impacto em produção em todo achado
- `VEREDITO: REPROVADO`

## Não deve conter

- Compose corrigido em bloco de código
- Sugestão de usar Kubernetes (conflita com `D-15`)
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 07-production-operations
MODO: REVISÃO
AMBIENTE: prod
ESCOPO ANALISADO: infra/compose/compose.prod.yml

O-01 Docker Compose   : FAIL — :3 :16 tag latest; :5 :18 :25 portas publicadas; sem healthcheck; :23 Redis sem persistência
O-02 CI/CD            : FAIL — :12 build no compose de produção
O-03 Logs e métricas  : N/A — fora do arquivo analisado
O-04 Alertas          : N/A — fora do arquivo analisado
O-05 Backups          : N/A — fora do arquivo analisado (ver pendência sobre ./data/pg)
O-06 Rollback         : FAIL — com latest e build local não existe versão anterior identificável para voltar

ACHADOS:
- [CRÍTICO] compose.prod.yml:18 — PostgreSQL publicado no host — impacto em produção: banco com
  contratos e outbox acessível fora da rede interna — viola O-01
- [CRÍTICO] compose.prod.yml:25 — Redis publicado no host — impacto: qualquer um alcança Streams,
  lease do líder e rate limit — viola O-01
- [ALTO] compose.prod.yml:23 — --save "" e --appendonly no — impacto: no reboot, mensagens pendentes
  de wallet:commands sumiram; as reservas nunca rodaram e os contratos ficaram em CREATED
  (causa do incidente; D-04) — viola O-01
- [ALTO] compose.prod.yml:5 — API publicada direto — impacto: tráfego sem TLS, WAF, CORS e rate limit
  do edge — viola O-01
- [ALTO] compose.prod.yml:6-8 :13-14 — depends_on sem condition e nenhum healthcheck — impacto: API e
  Tick Engine sobem antes do banco aceitar conexão e entram em loop de erro após reboot — viola O-01
- [ALTO] compose.prod.yml:3 :16 — tag latest — impacto: um pull/restart sobe versão diferente da
  testada, inclusive do banco — viola O-01, O-06
- [ALTO] compose.prod.yml:12 — build: em produção — impacto: o binário de prod nunca passou pelo
  staging; sem scan nem digest — viola O-02
- [MÉDIO] compose.prod.yml — sem restart: unless-stopped — impacto: após reboot, serviços não sobem
  sozinhos — viola O-01
- [MÉDIO] compose.prod.yml — sem limites de CPU/memória e sem rotação de log — impacto: um vazamento
  derruba o host; logs enchem o disco — viola O-01
- [MÉDIO] compose.prod.yml:20 — bind mount ./data/pg — impacto: dado acoplado ao diretório do
  deploy; preferir volume nomeado — viola O-01

ENCAMINHADO: compose.prod.yml:10 — credencial literal em DATABASE_URL → 04-security-iam (S-06)

PLANO DE VOLTA: inexistente
PENDÊNCIAS: backup/PITR do volume do PostgreSQL não aparece no escopo — revisar O-05 separadamente
VEREDITO: REPROVADO
```
