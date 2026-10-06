#!/usr/bin/env bash
# Relança a IDE em modo headless até a corrida da Fase 1 terminar.
# Cada sessão lê o prompt mestre, retoma de .orchestrator/state.yaml, conclui no máximo uma subtask e sai (P-06).
#
# Uso (confira a flag headless da sua IDE com --help antes de ligar):
#   AGENT_CMD='claude -p' bash docs/fase-1/scripts/run-loop.sh
#   AGENT_CMD='cursor-agent -p' bash docs/fase-1/scripts/run-loop.sh
#
# Variáveis: MAX_HOURS (48), MAX_SESSIONS (300), PAUSE_SECONDS (15), STALL_LIMIT (3).
# Para parar à mão: echo "HALTED: parada manual" > .orchestrator/STATUS
set -uo pipefail

: "${AGENT_CMD:?defina AGENT_CMD com o comando headless da IDE, ex.: AGENT_CMD='claude -p'}"
MAX_HOURS="${MAX_HOURS:-48}"
MAX_SESSIONS="${MAX_SESSIONS:-300}"
PAUSE_SECONDS="${PAUSE_SECONDS:-15}"
STALL_LIMIT="${STALL_LIMIT:-3}"

ROOT="$(git rev-parse --show-toplevel)" || exit 2
cd "$ROOT"

PROMPT_FILE="docs/fase-1/01-prompt-mestre.md"
STATUS_FILE=".orchestrator/STATUS"
STATE_FILE=".orchestrator/state.yaml"
mkdir -p .orchestrator/sessions

PROMPT="$(awk '/^````prompt$/{inside=1; next} /^````$/{if (inside) exit} inside' "$PROMPT_FILE")"
[ -n "$PROMPT" ] || { echo "bloco \`\`\`\`prompt não encontrado em $PROMPT_FILE"; exit 2; }

deadline=$(( $(date +%s) + MAX_HOURS * 3600 ))
session=0
stalled=0
last_state=""

halt() {
  echo "HALTED: $1" >"$STATUS_FILE"
  echo "HALTED: $1"
  exit 1
}

while :; do
  status="$(cat "$STATUS_FILE" 2>/dev/null || echo RUNNING)"
  case "$status" in
    FINISHED*) echo "Corrida concluída: $status"; exit 0 ;;
    HALTED*)   echo "Corrida parada: $status"; exit 1 ;;
  esac
  [ "$(date +%s)" -lt "$deadline" ] || halt "tempo máximo de ${MAX_HOURS} h atingido"
  [ "$session" -lt "$MAX_SESSIONS" ] || halt "limite de $MAX_SESSIONS sessões atingido"

  session=$((session + 1))
  log=".orchestrator/sessions/$(date -u +%Y%m%dT%H%M%SZ)-s$session.log"
  echo "[run-loop] sessão $session → $log"
  # AGENT_CMD é dividido em palavras de propósito (comando + flags).
  # shellcheck disable=SC2086
  $AGENT_CMD "$PROMPT" >"$log" 2>&1
  echo "[run-loop] sessão $session saiu com código $?"

  current_state="$(sha256sum "$STATE_FILE" 2>/dev/null | cut -d' ' -f1)"
  if [ -n "$current_state" ] && [ "$current_state" = "$last_state" ]; then
    stalled=$((stalled + 1))
  else
    stalled=0
    last_state="$current_state"
  fi
  [ "$stalled" -lt "$STALL_LIMIT" ] || halt "$STALL_LIMIT sessões seguidas sem mudança em $STATE_FILE (loop)"

  sleep "$PAUSE_SECONDS"
done
