#!/usr/bin/env bash
# Valida a estrutura do agente contra os modos de falha conhecidos e contra o catálogo do orquestrador.
# Uso: bash scripts/validate.sh   (ou AGENT_DIR=/caminho/do/agente bash validate.sh)
set -uo pipefail

SCRIPT_AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="${AGENT_DIR:-$SCRIPT_AGENT_DIR}"
[ -f "$AGENT_DIR/AGENT.md" ] || AGENT_DIR="$SCRIPT_AGENT_DIR"

AGENTS_ROOT="$(dirname "$AGENT_DIR")"
PROJECT_ROOT="$(dirname "$AGENTS_ROOT")"
AGENT_FILE="$AGENT_DIR/AGENT.md"
ORCHESTRATOR="$PROJECT_ROOT/ORCHESTRATOR.md"
FOLDER_NAME="$(basename "$AGENT_DIR")"
MAX_LINES=500
MAX_DESCRIPTION=250
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

echo "Validando agente: $FOLDER_NAME"
echo "----------------------------------------"

# 1. Estrutura
if [ ! -f "$AGENT_FILE" ]; then
  fail "AGENT.md ausente em $AGENT_DIR"
  exit 1
fi
pass "AGENT.md encontrado"

# 2. Frontmatter
frontmatter="$(awk 'NR==1 && $0!="---" {exit} NR>1 && $0=="---" {exit} NR>1 {print}' "$AGENT_FILE")"
if [ -z "$frontmatter" ]; then
  fail "frontmatter YAML ausente (arquivo deve começar com ---)"
else
  pass "frontmatter presente"
fi
field() { printf '%s\n' "$frontmatter" | awk -F': *' -v key="$1" '$1==key {sub(/^[^:]*: */, ""); print; exit}'; }

# 3. name = pasta
name="$(field name)"
if [ "$name" = "$FOLDER_NAME" ]; then pass "name igual à pasta ($name)"; else fail "name '$name' difere da pasta '$FOLDER_NAME'"; fi

# 4. description
description="$(printf '%s\n' "$frontmatter" | awk '
  /^description:/ { capture=1; sub(/^description:[ ]*>?[ ]*/, ""); if (length($0)) printf "%s ", $0; next }
  capture && /^[^ ]/ { exit }
  capture { sub(/^[ ]+/, ""); printf "%s ", $0 }
')"
description="${description% }"
desc_len="$(printf '%s' "$description" | wc -m | tr -d ' ')"
if [ -z "$description" ]; then
  fail "description ausente"
elif [ "$desc_len" -gt "$MAX_DESCRIPTION" ]; then
  fail "description com $desc_len caracteres (máximo $MAX_DESCRIPTION)"
else
  pass "description com $desc_len caracteres"
fi
case "$description" in
  Trigger:*) pass "description começa pelos triggers" ;;
  *) fail "description deve começar com 'Trigger:'" ;;
esac

# 5. version = CHANGELOG
version="$(field version)"
if [ -f "$AGENT_DIR/CHANGELOG.md" ]; then
  changelog_version="$(grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' "$AGENT_DIR/CHANGELOG.md" | head -n1 | tr -d '#[] ')"
  if [ -n "$version" ] && [ "$version" = "$changelog_version" ]; then
    pass "version $version igual ao CHANGELOG"
  else
    fail "version '$version' difere do CHANGELOG '$changelog_version'"
  fi
fi

# 6. permission válida e igual ao catálogo do orquestrador
permission="$(field permission)"
case "$permission" in
  write-code|read-only|write-tests-only) pass "permission válida ($permission)" ;;
  *) fail "permission '$permission' inválida (write-code | read-only | write-tests-only)" ;;
esac
if [ -f "$ORCHESTRATOR" ]; then
  catalog_permission="$(awk -v n="$name" '$0 ~ "- name: "n"$" {f=1; next} f && /permission:/ {sub(/.*permission: */, ""); print; exit}' "$ORCHESTRATOR")"
  if [ -z "$catalog_permission" ]; then
    fail "agente '$name' não registrado no catálogo do ORCHESTRATOR.md"
  elif [ "$catalog_permission" = "$permission" ]; then
    pass "permission igual ao catálogo do orquestrador"
  else
    fail "permission '$permission' difere do catálogo ('$catalog_permission')"
  fi

  catalog_caps="$(awk -v n="$name" '$0 ~ "- name: "n"$" {f=1; next} f && /capabilities:/ {sub(/.*capabilities: */, ""); print; exit}' "$ORCHESTRATOR" | tr -d '[] ')"
  agent_caps="$(field capabilities | tr -d '[] ')"
  if [ -n "$catalog_caps" ] && [ "$catalog_caps" = "$agent_caps" ]; then
    pass "capabilities iguais ao catálogo"
  else
    fail "capabilities '$agent_caps' diferem do catálogo '$catalog_caps'"
  fi
else
  warn "ORCHESTRATOR.md não encontrado — catálogo não verificado"
fi

# 7. Skills declaradas existem
skills="$(field skills | tr -d '[]' | tr ',' '\n' | sed 's/^ *//; s/ *$//')"
if [ -z "$skills" ]; then
  fail "lista de skills vazia no frontmatter"
fi
while IFS= read -r skill; do
  [ -z "$skill" ] && continue
  if [ -f "$PROJECT_ROOT/skills/$skill/SKILL.md" ]; then
    pass "skill existe: $skill"
  else
    fail "skill declarada não existe: $skill"
  fi
done <<< "$skills"

# 8. Tamanho
lines="$(wc -l < "$AGENT_FILE" | tr -d ' ')"
if [ "$lines" -lt "$MAX_LINES" ]; then pass "AGENT.md com $lines linhas (< $MAX_LINES)"; else fail "AGENT.md com $lines linhas (mover conteúdo para references/)"; fi

# 9. Seções obrigatórias
for section in "## Identidade no pool" "## Regras de ativação" "**Não ativar quando:**" "## Permissões e fronteiras" "## Contrato de entrada" "## Instruções" "## Regras invioláveis" "## Formato de saída" "## Exemplos" "## Edge cases"; do
  if grep -qF -- "$section" "$AGENT_FILE"; then pass "seção presente: $section"; else fail "seção ausente: $section"; fi
done

# 10. Formato de saída usa o contrato 2.2
for key in task_id agent status summary artifacts evidence acceptance_criteria_met confidence_score; do
  if awk '/^## Formato de saída/ {f=1} /^## Exemplos/ {f=0} f' "$AGENT_FILE" | grep -qE "^[[:space:]]*$key:"; then
    pass "formato de saída contém $key"
  else
    fail "formato de saída sem o campo $key (contrato 2.2)"
  fi
done

# 11. Blocos de código balanceados
fences="$(grep -cE '^[[:space:]]*```' "$AGENT_FILE" || true)"
if [ $((fences % 2)) -eq 0 ]; then pass "blocos de código balanceados ($fences delimitadores)"; else fail "bloco de código não fechado ($fences delimitadores)"; fi

# 12. Arquivos obrigatórios
for required in CHANGELOG.md scripts/validate.sh scripts/health-check.sh references/api-guide.md examples/example-1.md examples/example-2.md; do
  if [ -f "$AGENT_DIR/$required" ]; then pass "arquivo presente: $required"; else fail "arquivo ausente: $required"; fi
done

# 13. Pares de teste
test_count=0
for test_case in "$AGENT_DIR"/tests/test-case-*.md; do
  [ -e "$test_case" ] || continue
  test_count=$((test_count + 1))
  number="$(basename "$test_case" .md | sed 's/test-case-//')"
  if [ -f "$AGENT_DIR/tests/expected-output-$number.md" ]; then pass "par de teste completo: $number"; else fail "expected-output-$number.md ausente"; fi
done
[ "$test_count" -lt 2 ] && fail "mínimo de 2 test-cases (encontrados: $test_count)"

# 14. Caminhos citados existem
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  if [ -e "$AGENT_DIR/$ref" ]; then pass "caminho citado existe: $ref"; else fail "caminho citado não existe: $ref"; fi
done < <(grep -oE '`(references|examples|tests|scripts)/[A-Za-z0-9._/-]+`' "$AGENT_FILE" | tr -d '`' | sort -u)

# 15. Agentes duplicados
duplicates="$(grep -lE "^name:[[:space:]]*$name[[:space:]]*$" "$AGENTS_ROOT"/*/AGENT.md 2>/dev/null | wc -l | tr -d ' ')"
if [ "$duplicates" -gt 1 ]; then fail "name '$name' duplicado em $duplicates agentes"; else pass "nenhum agente duplicado"; fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: REPROVADO ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: APROVADO ($WARNINGS aviso(s))"
