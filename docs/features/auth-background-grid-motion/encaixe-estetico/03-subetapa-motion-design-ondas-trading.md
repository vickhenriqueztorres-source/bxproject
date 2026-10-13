# Subetapa 03: Motion Design das Ondas de Trading de Escala Ampla (`AuthBackgroundGridMotion.tsx` + `tokens-precision.css`)

**Responsável:** `chief-visual-director` (design) + `surgical-frontend-agent` (código)  
**Validação:** `qa-resilience-agent`  
**Status:** PRONTO PARA EXECUÇÃO  

---

## 1. Objetivo Técnico e Visual

Projetar uma trajetória vetorial panorâmica para as ondas de trading, fazendo com que elas atravessem a tela de ponta a ponta (`viewBox="0 0 1920 1080"`), passando suavemente por trás do mini-gráfico e sob o card fintech, proporcionando uma dinâmica contínua e equilibrada de movimento orgânico a 60 FPS.

---

## 2. Passo a Passo de Implementação Cirúrgica

1. **Editar `apps/web/src/components/auth/AuthBackgroundGridMotion.tsx`**:
   - Atualizar a malha de ondas com proporção cinematográfica de 1920x1080.
   - **Onda Primária (Tendência Principal):** Traçado sinuoso suave com bezier cúbica `M -100 850 C 300 820, 600 700, 960 580 C 1320 460, 1600 320, 2020 220`, stroke de 2.2px com gradiente esmeralda neon (`#22C47A` -> `#34D399` -> `#6EEDB8`), e decaimento vertical translúcido.
   - **Onda Secundária (Contraponto Harmônico):** Traçado de apoio pontilhado com stroke-dasharray `4 3`, stroke 1.2px, criando a sobreposição de séries temporais de alta precisão.
   - **Partículas / Pulso nos Vértices:** Pulsos discretos de 2px nos pontos nodais da onda para simular cotação em tempo real.

2. **Editar `apps/web/src/styles/tokens-precision.css`**:
   - Ajustar `@keyframes bmWaveDrift` ou criar `@keyframes bmWaveSinuous` com translação sutil (`transform: translateY(0px) rotate(0deg)` a `translateY(-14px) rotate(0.4deg)`) com ciclo de 16 segundos e aceleração inercial suave.
   - Respeito obrigatório a `@media (prefers-reduced-motion: reduce)`.

---

## 3. Critérios de Aceite e Testes Rigorosos

- **Teste de Física de Movimento:** Zero saltos, zero solavancos, frame rate cravado a 60 FPS sem consumo excessivo de CPU.
- **Auditoria Anti-Cassino:** Ausência total de tremores de tela (shake), raios de moedas ou confetes.
- **Teste de Acessibilidade:** Em modo de movimento reduzido, as ondas permanecem estáticas e com contraste elegante.
