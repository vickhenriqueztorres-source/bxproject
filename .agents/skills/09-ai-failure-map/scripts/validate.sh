#!/usr/bin/env bash
# Valida a estrutura da skill contra os modos de falha conhecidos.
# Uso: bash scripts/validate.sh   (ou SKILL_DIR=/caminho/da/skill bash validate.sh)
set -uo pipefail

SCRIPT_SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="${SKILL_DIR:-$SCRIPT_SKILL_DIR}"
[ -f "$SKILL_DIR/SKILL.md" ] || SKILL_DIR="$SCRIPT_SKILL_DIR"

SKILLS_ROOT="$(dirname "$SKILL_DIR")"
SKILL_FILE="$SKILL_DIR/SKILL.md"
FOLDER_NAME="$(basename "$SKILL_DIR")"
MAX_LINES=500
MAX_DESCRIPTION=250
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

echo "Validando skill: $FOLDER_NAME"
echo "----------------------------------------"

# 1. Estrutura: pasta nomeada com SKILL.md
if [ ! -f "$SKILL_FILE" ]; then
  fail "SKILL.md ausente em $SKILL_DIR"
  exit 1
fi
pass "SKILL.md encontrado"

# 2. Frontmatter YAML
frontmatter="$(awk 'NR==1 && $0!="---" {exit} NR>1 && $0=="---" {exit} NR>1 {print}' "$SKILL_FILE")"
if [ -z "$frontmatter" ]; then
  fail "frontmatter YAML ausente (arquivo deve começar com ---)"
else
  pass "frontmatter presente"
fi

# 3. name = nome da pasta
name="$(printf '%s\n' "$frontmatter" | awk -F': *' '$1=="name" {print $2; exit}')"
if [ "$name" = "$FOLDER_NAME" ]; then
  pass "name igual à pasta ($name)"
else
  fail "name '$name' difere da pasta '$FOLDER_NAME'"
fi

# 4. description: existe, <= 250 caracteres, começa pelos triggers
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

# 5. version no frontmatter = última versão do CHANGELOG
version="$(printf '%s\n' "$frontmatter" | awk -F': *' '$1=="version" {print $2; exit}')"
if [ -f "$SKILL_DIR/CHANGELOG.md" ]; then
  changelog_version="$(grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' "$SKILL_DIR/CHANGELOG.md" | head -n1 | tr -d '#[] ')"
  if [ -n "$version" ] && [ "$version" = "$changelog_version" ]; then
    pass "version $version igual ao CHANGELOG"
  else
    fail "version '$version' difere do CHANGELOG '$changelog_version'"
  fi
fi

# 6. Tamanho (progressive disclosure)
lines="$(wc -l < "$SKILL_FILE" | tr -d ' ')"
if [ "$lines" -lt "$MAX_LINES" ]; then
  pass "SKILL.md com $lines linhas (< $MAX_LINES)"
else
  fail "SKILL.md com $lines linhas (mover conteúdo para references/ ou examples/)"
fi

# 7. Seções obrigatórias
for section in "## Regras de ativação" "**Não ativar quando:**" "## Instruções" "## Formato de saída" "## Exemplos" "## Edge cases"; do
  if grep -qF -- "$section" "$SKILL_FILE"; then
    pass "seção presente: $section"
  else
    fail "seção ausente: $section"
  fi
done

# 8. Blocos de código balanceados
fences="$(grep -cE '^[[:space:]]*```' "$SKILL_FILE" || true)"
if [ $((fences % 2)) -eq 0 ]; then
  pass "blocos de código balanceados ($fences delimitadores)"
else
  fail "bloco de código não fechado ($fences delimitadores)"
fi

# 9. Arquivos obrigatórios da estrutura
for required in CHANGELOG.md scripts/validate.sh scripts/health-check.sh references/api-guide.md examples/example-1.md examples/example-2.md; do
  if [ -f "$SKILL_DIR/$required" ]; then
    pass "arquivo presente: $required"
  else
    fail "arquivo ausente: $required"
  fi
done

# 10. Todo test-case tem expected-output correspondente
test_count=0
for test_case in "$SKILL_DIR"/tests/test-case-*.md; do
  [ -e "$test_case" ] || continue
  test_count=$((test_count + 1))
  number="$(basename "$test_case" .md | sed 's/test-case-//')"
  if [ -f "$SKILL_DIR/tests/expected-output-$number.md" ]; then
    pass "par de teste completo: $number"
  else
    fail "expected-output-$number.md ausente"
  fi
done
if [ "$test_count" -lt 2 ]; then
  fail "mínimo de 2 test-cases (encontrados: $test_count)"
fi

# 11. Caminhos internos citados no SKILL.md existem
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  if [ -e "$SKILL_DIR/$ref" ]; then
    pass "caminho citado existe: $ref"
  else
    fail "caminho citado não existe: $ref"
  fi
done < <(grep -oE '`(references|examples|tests|scripts)/[A-Za-z0-9._/-]+`' "$SKILL_FILE" | tr -d '`' | sort -u)

# 12. Skills duplicadas (mesmo name em outra pasta)
duplicates="$(grep -lE "^name:[[:space:]]*$name[[:space:]]*$" "$SKILLS_ROOT"/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')"
if [ "$duplicates" -gt 1 ]; then
  fail "name '$name' duplicado em $duplicates skills"
else
  pass "nenhuma skill duplicada"
fi

# 13. Arquivo .md solto na raiz de skills/
loose="$(find "$SKILLS_ROOT" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')"
if [ "$loose" -gt 0 ]; then
  warn "$loose arquivo(s) .md solto(s) em $SKILLS_ROOT (não são tratados como skill)"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: REPROVADO ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: APROVADO ($WARNINGS aviso(s))"
