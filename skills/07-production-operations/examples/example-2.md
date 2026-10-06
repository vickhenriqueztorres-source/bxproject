# Exemplo 2 — Pipeline, migration expand/contract, rollback e restore

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Pedido:** "Release 1.4 renomeia `stake` para `amount`. Montar pipeline, migrations, rollback e o ensaio de restore."
- **Regras cobertas:** `O-02`, `O-05`, `O-06`, `I-05`, `I-06`, `M-04`

Ferramenta de CI é `<não definido no contexto>`; o exemplo usa GitHub Actions. pgBackRest e Trivy são PROPOSTOS.

## Pipeline — `.github/workflows/pipeline.yml`

```yaml
name: pipeline
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: pnpm test:unit
      - run: pnpm test:integration
      - run: promtool test rules infra/prometheus/tests/*.test.yml
      - uses: gitleaks/gitleaks-action@v2

  build:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, ws-gateway, chart-api, tick-engine, outbox-relay, candle-worker, settlement-worker, wallet-adapter, migrate]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: "${{ vars.REGISTRY }}", username: "${{ secrets.REGISTRY_USER }}", password: "${{ secrets.REGISTRY_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with:
          context: services/${{ matrix.service }}
          load: true
          push: false
          tags: ${{ vars.REGISTRY }}/sintetico/${{ matrix.service }}:${{ github.sha }}
      - uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ${{ vars.REGISTRY }}/sintetico/${{ matrix.service }}:${{ github.sha }}
          severity: CRITICAL
          exit-code: "1"
      - run: docker push ${{ vars.REGISTRY }}/sintetico/${{ matrix.service }}:${{ github.sha }}

  staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: ./infra/deploy/deploy.sh staging ${{ github.sha }}
      - run: pnpm test:acceptance --base-url "${{ vars.STAGING_URL }}"

  production:
    needs: staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: ./infra/deploy/deploy.sh prod ${{ github.sha }}
```

- `environment: production` com revisores obrigatórios = aprovação humana (estágio 9).
- A tag é o SHA do commit; prod recebe **a mesma** imagem do staging — sem rebuild.
- Push em `main` só chega a prod depois de staging verde + aprovação.

## Deploy com janela de observação — `infra/deploy/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
ENV="$1"
TAG="$2"
HOST_VAR="DEPLOY_HOST_${ENV^^}"
HOST="${!HOST_VAR:?host do ambiente não configurado}"
DIR=/srv/sintetico
COMPOSE="docker compose -f infra/compose/docker-compose.yml -f infra/compose/compose.${ENV}.yml"

PREVIOUS="$(ssh "$HOST" "cat $DIR/CURRENT_TAG 2>/dev/null || true")"

scp -r infra/compose "$HOST:$DIR/infra/"
ssh "$HOST" "cd $DIR && TAG=$TAG $COMPOSE pull --quiet"
ssh "$HOST" "cd $DIR && TAG=$TAG $COMPOSE run --rm migrate up"
ssh "$HOST" "cd $DIR && TAG=$TAG $COMPOSE up -d --wait --wait-timeout 120"
ssh "$HOST" "echo $TAG > $DIR/CURRENT_TAG && echo ${PREVIOUS:-none} > $DIR/PREVIOUS_TAG"

if ! ./infra/deploy/observe.sh "$ENV" 900; then
  if [ -z "$PREVIOUS" ]; then
    echo "janela falhou e não há versão anterior registrada" >&2
    exit 1
  fi
  echo "janela de observação falhou — rollback para $PREVIOUS" >&2
  ssh "$HOST" "cd $DIR && TAG=$PREVIOUS $COMPOSE up -d --wait --wait-timeout 120"
  ssh "$HOST" "echo $PREVIOUS > $DIR/CURRENT_TAG"
  exit 1
fi
```

## `infra/deploy/observe.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
ENV="$1"
WINDOW="$2"
PROM="${PROMETHEUS_URL:?PROMETHEUS_URL obrigatória}"
END=$((SECONDS + WINDOW))
QUERY="count(ALERTS{alertstate=\"firing\",severity=\"critical\",env=\"$ENV\"}) or vector(0)"

while [ "$SECONDS" -lt "$END" ]; do
  firing="$(curl -fsS --max-time 5 "$PROM/api/v1/query" --data-urlencode "query=$QUERY" | jq -r '.data.result[0].value[1]')"
  if [ "$firing" != "0" ]; then
    echo "alertas críticos disparando: $firing" >&2
    exit 1
  fi
  sleep 30
done
```

- O runner precisa alcançar o Prometheus (runner na rede ou acesso autenticado via edge) — `<não definido no contexto>`.
- Rollback = mesmo `up -d` com a tag anterior: segundos, sem build (O-06).
- O rollback **não** roda `migrate down`: as migrations do release são só de expand e compatíveis com N-1.

## Migrations expand/contract

`db/migrations/0012_expand_amount.up.sql` (release 1.4):

```sql
SET lock_timeout = '2s';

ALTER TABLE contracts ADD COLUMN amount numeric(18, 2); -- mesmo tipo/precisão de stake

CREATE OR REPLACE FUNCTION contracts_sync_amount() RETURNS trigger AS $$
BEGIN
  IF NEW.amount IS NULL THEN NEW.amount := NEW.stake; END IF;
  IF NEW.stake IS NULL THEN NEW.stake := NEW.amount; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_sync_amount
  BEFORE INSERT OR UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION contracts_sync_amount();
```

`db/migrations/0012_expand_amount.down.sql`:

```sql
SET lock_timeout = '2s';
DROP TRIGGER IF EXISTS contracts_sync_amount ON contracts;
DROP FUNCTION IF EXISTS contracts_sync_amount();
ALTER TABLE contracts DROP COLUMN IF EXISTS amount;
```

Backfill (job separado, em lotes, repetido até 0 linhas):

```sql
UPDATE contracts
   SET amount = stake
 WHERE id IN (SELECT id FROM contracts WHERE amount IS NULL LIMIT 1000);
```

| Release | Código | Migration | Rollback por imagem |
|---------|--------|-----------|---------------------|
| 1.4 | lê `stake`, escreve nas duas | `0012` expand + backfill | sim (1.3 ignora `amount`) |
| 1.5 | lê `amount`, escreve nas duas | — | sim (1.4 lê `stake`, que segue sincronizado) |
| 1.6 | só `amount` | `0020` contract: `DROP TRIGGER`, `DROP COLUMN stake` | para 1.5 não; só depois de 1.5 estável |

`legacy_payout` segue o mesmo caminho: parar de ler/escrever num release, `DROP` no seguinte, depois de confirmar que nenhum relatório usa a coluna.

## Backup — `infra/backup/pgbackrest.conf`

```ini
[global]
repo1-type=s3
repo1-s3-bucket=<não definido no contexto>
repo1-s3-endpoint=<não definido no contexto>
repo1-s3-region=<não definido no contexto>
repo1-cipher-type=aes-256-cbc
repo1-retention-full=30
compress-type=zst
start-fast=y

[platform]
pg1-path=/var/lib/postgresql/data

[blnk]
pg1-host=blnk-db
pg1-path=/var/lib/postgresql/data

[keycloak]
pg1-host=keycloak-db
pg1-path=/var/lib/postgresql/data
```

- Senha de criptografia e credenciais do storage via `PGBACKREST_REPO1_CIPHER_PASS` e afins, vindas de `secrets:` (`04-security-iam`).
- Backup full diário por stanza; WAL contínuo via `archive_command` (exemplo 1). Retenção de 30 dias PROPOSTA.
- `backup_last_success_timestamp_seconds` exportado por um exporter do pgBackRest — PROPOSTO — alimenta `BackupMissing`.

## Ensaio de restore — `infra/backup/restore-drill.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:?uso: restore-drill.sh '2026-03-10 02:30:00+00'}"
DRILL="docker compose -p drill -f infra/compose/docker-compose.yml -f infra/compose/compose.drill.yml"
START=$(date +%s)

for stanza in platform blnk keycloak; do
  $DRILL run --rm "restore-$stanza" \
    pgbackrest --stanza="$stanza" --type=time --target="$TARGET" --target-action=promote --delta restore
done

TAG="$(cat /srv/sintetico/CURRENT_TAG)" $DRILL up -d --wait

$DRILL run --rm outbox-relay republish --unpublished
$DRILL run --rm api reconcile --fail-on-divergence
$DRILL run --rm api verify-tick-chain --until "$TARGET"
$DRILL run --rm api verify-identities

echo "restore_seconds=$(( $(date +%s) - START )) target=$TARGET"
```

- `compose.drill.yml` remove as portas do edge: o ambiente restaurado não recebe tráfego.
- Os três bancos voltam para o **mesmo** `TARGET`; sem isso, plataforma e Blnk divergem.
- `reconcile` (`I-05`), `verify-tick-chain` (`M-04`) e `verify-identities` (carteira ↔ `sub` no Keycloak) são CLIs da aplicação — PROPOSTO.
- O tempo impresso vai para `runbooks/restore.md` e é comparado com o RTO (`<não definido no contexto>`).
