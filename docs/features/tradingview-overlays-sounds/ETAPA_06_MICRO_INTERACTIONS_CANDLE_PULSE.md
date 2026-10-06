# Subetapa 6: Micro-interações e Pulso de Vela a cada Tick

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Especialista em Mercados:** `broker-architect-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 6 APROVADO)  

---

## 1. Objetivo da Etapa
Criar a assinatura tátil visual da IQ Option: a **Micro-interação de Pulso da Vela**:
- A cada novo tick recebido via WebSocket / gerador OTC:
  - O indicador de preço emite um flash sutil com anel de refração expansivo (`@keyframes tickRipple`).
  - O cabeçalho de cotação atual sofre uma micro-pulsação de escala (`scale(1.04) -> scale(1.0)`).
  - O cursor da boleta e os botões respondem com feedback visual e sonoro imediato a cada clique em steppers ou presets.

---

## 2. Especificação Técnica
- Hook de animação reativo `useTickPulse(tick)`.
- Classe CSS `.tick-pulse-green` e `.tick-pulse-red` ativada por 180ms a cada mudança de preço.
- Zero vazamento de timers com cancelamento automático de `requestAnimationFrame` ou `setTimeout`.

---

## 3. Matriz de Testes & Validação da Etapa 6

### A. Teste de Framerate (60 FPS contínuos)
- Injeção contínua de 30 ticks por segundo:
  - As micro-animações devem rodar via GPU (`transform` e `opacity`) sem causar repaint em toda a página.
  - A thread principal de JavaScript deve se manter abaixo de 10% de utilização.

---

## 4. Critérios de Passagem (Quality Gate 6)
- [ ] Pulso de tick visível e suave a cada nova cotação.
- [ ] Steppers com micro-interação sonora e visual.
- [ ] Sem lag ou queda perceptível de framerate.
