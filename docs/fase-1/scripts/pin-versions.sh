#!/usr/bin/env bash
# Fase 0: resolve a versão exata de cada pacote e o digest de cada imagem e grava docs/fase-1/versoes.lock.md.
# Uso: bash docs/fase-1/scripts/pin-versions.sh
# Precisa de rede, npm e Docker. As majors seguem 08-versoes-fixadas.md; ajuste as listas se mudar lá.
# Uma linha "FALHOU" precisa ser resolvida antes da tag fase1-governanca (o pré-voo reprova).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
OUT="docs/fase-1/versoes.lock.md"

NPM_PACKAGES=(
  "typescript@5" "lightweight-charts@5" "oidc-client-ts@3" "jose" "zod" "ioredis@5" "pg@8"
  "react@19" "react-dom@19" "vite" "react-admin@5" "ra-data-simple-rest@5"
  "vitest" "@playwright/test" "prom-client" "pino" "@sentry/node"
)

IMAGES=(
  "postgres:16"
  "redis:7"
  "quay.io/keycloak/keycloak:${KEYCLOAK_TAG:-26.0}"
  "blnkfinance/blnk:${BLNK_TAG:-latest}"
  "ghcr.io/shopify/toxiproxy:${TOXIPROXY_TAG:-latest}"
  "prom/prometheus:${PROMETHEUS_TAG:-latest}"
  "grafana/grafana:${GRAFANA_TAG:-latest}"
  "grafana/loki:${LOKI_TAG:-latest}"
  "axllent/mailpit:${MAILPIT_TAG:-latest}"
)

resolve_npm() {
  local spec="$1" raw
  raw="$(npm view "$spec" version --json 2>/dev/null)" || { echo "FALHOU"; return; }
  node -e 'const v = JSON.parse(process.argv[1]); console.log(Array.isArray(v) ? v[v.length - 1] : v)' "$raw" 2>/dev/null \
    || echo "FALHOU"
}

resolve_image() {
  local image="$1"
  docker pull -q "$image" >/dev/null 2>&1 || { echo "FALHOU"; return; }
  docker image inspect --format '{{index .RepoDigests 0}}' "$image" 2>/dev/null || echo "FALHOU"
}

tool_version() {
  "$@" 2>/dev/null | head -n 1 || true
}

failures=0
{
  echo "# Versões resolvidas (lock)"
  echo
  echo "Gerado por \`scripts/pin-versions.sh\` em $(date -u +%FT%TZ). Use **exatamente** estas versões."
  echo "Imagens: referencie pelo digest (\`imagem@sha256:…\`), nunca pela tag."
  echo
  echo "## Ferramentas da máquina"
  echo
  echo "| Ferramenta | Versão |"
  echo "|---|---|"
  echo "| node | $(tool_version node -v) |"
  echo "| pnpm | $(tool_version pnpm -v) |"
  echo "| docker | $(tool_version docker version --format '{{.Server.Version}}') |"
  echo "| docker compose | $(tool_version docker compose version --short) |"
  echo "| k6 | $(tool_version k6 version) |"
  echo
  echo "## Pacotes npm"
  echo
  echo "| Pacote (major) | Versão exata |"
  echo "|---|---|"
  for spec in "${NPM_PACKAGES[@]}"; do
    version="$(resolve_npm "$spec")"
    [ "$version" != "FALHOU" ] || failures=$((failures + 1))
    echo "| \`$spec\` | \`$version\` |"
  done
  echo
  echo "## Imagens"
  echo
  echo "| Imagem (tag pedida) | Digest |"
  echo "|---|---|"
  for image in "${IMAGES[@]}"; do
    digest="$(resolve_image "$image")"
    [ "$digest" != "FALHOU" ] || failures=$((failures + 1))
    echo "| \`$image\` | \`$digest\` |"
  done
} >"$OUT"

echo "gravado: $OUT ($failures falha(s))"
[ "$failures" -eq 0 ]
