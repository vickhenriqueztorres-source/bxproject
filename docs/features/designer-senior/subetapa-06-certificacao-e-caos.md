# Subetapa 06 — Certificação Final Integrada, Testes de Caos, Estresse e Homologação

> **Filosofia:** A prova matemática e visual definitiva de que a BINMAX é um instrumento de precisão cirúrgica e está 100% blindada contra elementos de cassino.

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `tests/unit/senior-designer-certification.unit.test.ts` (Bateria de auditoria automática em código)
- `tests/chaos/ui-anti-casino-chaos.test.ts` (Testes de caos de interface e anti-patterns)
- `docs/features/designer-senior/RELATORIO-HOMOLOGACAO-DESIGNER-SENIOR.md` (Relatório final com evidências)

---

## 2. Passo a Passo de Execução

1. **Auditoria Estática de Código (Anti-patterns Scan)**:
   - Script automatizado que escaneia `apps/web/src/**` garantindo:
     - Zero ocorrências de sons proibidos (`coin`, `jackpot`, `chaching`, `bell`).
     - Zero classes CSS contendo `shake`, `bounce`, `sparkle`, `confetti`.
     - Zero pop-ups com "Parabéns" em tela cheia.
     - Presença das variáveis de tokens de movimento `--bm-ease`, `--bm-t-micro`, `--bm-t-base`, `--bm-t-enter`, `--bm-t-count`.

2. **Bateria Completa de Testes**:
   - Rodar todas as suítes de testes de frontend:
     - Subetapa 01: `tokens-precision.unit.test.ts`
     - Subetapa 02: `verification-settings.unit.test.tsx` e `verification-precision-stress.unit.test.tsx`
     - Subetapa 03: `auth-precision-stress.unit.test.tsx` e `auth-pages.unit.test.tsx`
     - Subetapa 04: `wallet-precision-stress.unit.test.tsx` e `billetera.unit.test.tsx`
     - Subetapa 05: `traderoom-precision-stress.unit.test.tsx` e `trade-result-toast.unit.test.tsx`

3. **Homologação e Veredito Formal**:
   - Convocação do subagente `designer-senior` para auditoria final e emissão do parecer com tabela dos 10 critérios e veredito `APROVADO`.

---

## 3. Critério de Aceite da Subetapa 06
- 100% dos testes da suíte Vitest passando sem falhas.
- Parecer formal do `designer-senior` aprovado sem vetos.
