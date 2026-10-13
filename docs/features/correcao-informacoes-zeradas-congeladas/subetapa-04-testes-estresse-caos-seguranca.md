# Subetapa 04: Bateria Global de Estresse, Caos, Segurança Financeira e Certificação sem Regressão

> **Agente**: `qa-resilience-agent`  
> **Revisores**: `financial-correctness-reviewer`, `regression-guardian-agent`, `broker-architect-agent`  
> **Skills**: `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `19-testes-de-regressao-visual`

---

## 1. Objetivo Técnico
Validar o sistema de forma holística contra todos os cenários extremos de estresse, falha de rede, dessincronia de relógio, congelamento de navegador e invariantes financeiros invioláveis, provando que o defeito está permanentemente sanado e nenhuma outra funcionalidade foi comprometida.

---

## 2. Cenários da Bateria de Caos e Estresse
1. **Caos 1: Hibernação de Aba / Wake-from-sleep**:
   - Simular um salto de relógio onde o tempo avança 5 minutos instantaneamente (`vi.advanceTimersByTime(300000)` ou alteração brusca de `Date.now()`).
   - Verificar se todos os contratos pendentes são imediatamente liquidados e saem da lista de abertos sem deixar nenhuma informação congelada.
2. **Caos 2: Falha e Re-tentativa Concorrente**:
   - Disparar múltiplas leituras e escritas concorrentes em `getContracts()`, `openContract()` e reconciliação simultânea.
   - Provar ausência de condições de corrida (race conditions) e que nenhum contrato é liquidado duas vezes (idempotência local).
3. **Segurança Financeira (Invariantes I-01 a I-06)**:
   - A soma total de `available_minor + reserved_minor` antes e depois das operações deve ser rigorosamente consistente com os lucros/perdas computados.
   - Proibir números negativos, floats, ou arredondamentos incorretos de centavos.
4. **Regressão Global**:
   - Execução de toda a suíte de testes unitários e de integração relevantes para garantir zero regressões.

---

## 3. Arquivos Criados / Executados
- `apps/web/src/trade/portfolio-unfreeze-stress-chaos.unit.test.tsx`
- Execução completa do runner de testes `vitest`.

---

## 4. Critério de Aceite Final
- [ ] 100% dos testes de estresse, caos e segurança aprovados.
- [ ] Terminal limpo, sem ordens congeladas a 0s, sem flags fantasmas no gráfico, e com rodapé matematicamente exato.
