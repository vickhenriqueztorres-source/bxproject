#!/usr/bin/env bash
# Prova de "nada alterado" (PV-01): fingerprint do repositório antes e depois da verificação.
# Uso:
#   bash scripts/health-check.sh before [raiz]   → grava o fingerprint
#   bash scripts/health-check.sh after  [raiz]   → compara; exit 1 se algo mudou
# Ignora .git, node_modules, .orchestrator/ (evidência do gate) e artefatos de build.
set -uo pipefail

MODE="${1:-}"
ROOT="$(cd "${2:-.}" && pwd)"
case "$MODE" in before|after) ;; *) echo "uso: health-check.sh before|after [raiz]"; exit 2 ;; esac

KEY="$(printf '%s' "$ROOT" | sha256sum | cut -c1-12)"
STORE="${TMPDIR:-/tmp}/post-implementation-verifier-$KEY"

fingerprint() {
  (cd "$ROOT" && find . -type f \
      -not -path './.git/*' -not -path '*/node_modules/*' -not -path './.orchestrator/*' \
      -not -path './.next/*' -not -path '*/dist/*' -not -path '*/coverage/*' -not -name '*.tsbuildinfo' \
      -print0 | sort -z | xargs -0 sha256sum)
}

head_sha() { git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo "sem-git"; }

if [ "$MODE" = "before" ]; then
  fingerprint > "$STORE.files"
  head_sha > "$STORE.head"
  echo "fingerprint: $(sha256sum < "$STORE.files" | cut -c1-64)"
  echo "head: $(cat "$STORE.head")"
  echo "arquivos: $(wc -l < "$STORE.files" | tr -d ' ')"
  exit 0
fi

if [ ! -f "$STORE.files" ]; then
  echo "[FAIL] nenhum fingerprint 'before' para $ROOT — rodar 'before' antes da verificação"
  exit 1
fi

current="$(mktemp)"
fingerprint > "$current"
before_hash="$(sha256sum < "$STORE.files" | cut -c1-64)"
after_hash="$(sha256sum < "$current" | cut -c1-64)"
echo "before: $before_hash"
echo "after:  $after_hash"

status=0
if [ "$(head_sha)" != "$(cat "$STORE.head")" ]; then
  echo "[FAIL] HEAD mudou durante a verificação: $(cat "$STORE.head") → $(head_sha) (PV-03)"
  status=1
fi
if [ "$before_hash" != "$after_hash" ]; then
  echo "[FAIL] arquivos alterados durante a verificação (PV-01):"
  diff <(awk '{print $2" "$1}' "$STORE.files") <(awk '{print $2" "$1}' "$current") | grep -E '^[<>]' | head -n 20 | sed 's/^/    /'
  status=1
fi
rm -f "$current"

if [ "$status" -eq 0 ]; then
  echo "[OK]   nada alterado — fingerprint igual e HEAD igual"
fi
exit "$status"
