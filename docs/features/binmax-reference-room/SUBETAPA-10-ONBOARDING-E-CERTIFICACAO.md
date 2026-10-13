# SUBETAPA 10: ONBOARDING DO LEAD & CERTIFICAÇÃO FINAL INTEGRADA (SESSÃO 12)

**Objetivo:** Implementar o sistema de onboarding guiado do lead (coachmarks interativos de 3 passos) para novos usuários da plataforma (Sessão 12) e executar a certificação final integrada de todas as 12 telas com 100% dos testes aprovados.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/onboarding/LeadOnboardingTour.tsx` (ou componente equivalente)
  * `apps/web/src/trade/final-certification.unit.test.tsx`
  * `apps/web/src/App.tsx`
- **Fronteira Proibida:** O tour de onboarding é estritamente educativo; ele nunca dispara ordens financeiras de forma autônoma.

---

## 2. Detalhamento do Onboarding (Sessão 12)

### 2.1 Elementos dos Coachmarks:
- **Card Flutuante Ancorado (Paso 1 de 3):**
  * Ancoragem: Sobre o Ticket de Ordens (seção Monto).
  * Indicador de Progresso: `Paso 1 de 3` em cinza claro.
  * Título: `Elige cuánto invertir` em Archivo Bold branco.
  * Texto explicativo: `Empieza con poco en la cuenta de práctica.`.
  * Botões:
    - Botão primário: `Siguiente` em ciano/azul `#00e5ff` com texto escuro.
    - Botão secundário: `Saltar` em texto discreto.
- **Paso 2 de 3 (Seleção de Ativo):**
  * Ancorado nas abas superiores ou no seletor de ativos.
  * Texto: `Explora los activos y su porcentaje de ganancia.`.
- **Paso 3 de 3 (Tomada de Decisão):**
  * Ancorado sobre os botões `SUBE` e `BAJA`.
  * Texto: `Pronostica si el precio subirá o bajará en el tiempo elegido.`.
- **Persistência:**
  * Gravação da chave `BINMAX_ONBOARDING_SEEN = "true"` no `localStorage` após conclusão ou salto.

---

## 3. Passo a Passo de Execução

1. **Desenvolvimento do Componente `LeadOnboardingTour.tsx`:**
   Renderizar os tooltips posicionados com overlay de foco sem bloquear interações normais.
2. **Integração no `App.tsx`:**
   Ativar condicionalmente para novos usuários em modo demo.
3. **Execução da Bateria Completa de Testes de Certificação:**
   * Todos os testes unitários (409+ testes).
   * Teste de estresse, caos e regressão visual.
4. **Emissão do Relatório Final de Entrega.**

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Avanço de passos (1 -> 2 -> 3 -> fim).
- Comportamento do botão `Saltar`.
- Verificação do storage local.

### 4.2 Teste Integrado de Estresse e Caos:
- Execução simultânea de ticks a 50Hz, abertura de gavetas e navegação no onboarding sem crash.

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Onboarding idêntico à Sessão 12.
- 100% dos testes do projeto aprovados (zero falhas).
