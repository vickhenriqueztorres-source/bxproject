# Subetapa 05 — Certificação Integrada: Estresse, Segurança, Caos, Build e Regressão Total

> **Agentes Alocados**: `qa-resilience-agent`, `security-reviewer`, `financial-correctness-reviewer`, `regression-guardian-agent`, `post-implementation-verifier`
> **Skills**: `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`, `18-zonas-sensiveis`, `19-testes-de-regressao-visual`
> **Status**: CONCLUÍDA E VALIDADA (100% — `torneios-arena-i18n-certification.unit.test.tsx`: 4/4 passed; 62/62 nas 6 suítes dedicadas)

---

## 1. Objetivo da Subetapa
Executar a bateria final de certificação de ponta a ponta cobrindo a integração das Subetapas 01 a 04:
1. **Suíte Integrada de Estresse, Segurança e Caos (`tests/torneios-arena-i18n-certification.unit.test.tsx`)**:
   - Fluxo E2E completo em memória: Usuário na Sala de Trading (`pt-BR`) → abre `Torneios` no menu lateral → visualiza `Copa BINMAX` → inscreve-se → troca idioma para `es-ES` no topo → verifica tradução instantânea de toda a Sala, Menu, Header, Footer e Torneios → clica em `Arena` no menu lateral → entra na `Sala Plata` da Arena Blitz em Espanhol → executa ordem `SUBE` → alterna para `pt-BR` → verifica ordem ativa em Português (`ACIMA`) → volta para `Operar` no menu lateral.
2. **Auditoria de Zonas Sensíveis (`regression-guardian-agent`)**:
   - Verificar via `git status` / `git diff` que nenhum arquivo vermelho de [`docs/zonas-sensiveis.txt`](../../../docs/zonas-sensiveis.txt) foi modificado.
3. **Validação de Build e Typecheck**:
   - Executar `pnpm --filter @ synth/web build` (ou `vite build` em `apps/web`) para garantir bundle de produção limpo e sem erros de TypeScript.
4. **Execução Completa da Suíte de Testes**:
   - Rodar 100% dos testes unitários de `apps/web/src` (legados + novos) e registrar o relatório de aprovação.
