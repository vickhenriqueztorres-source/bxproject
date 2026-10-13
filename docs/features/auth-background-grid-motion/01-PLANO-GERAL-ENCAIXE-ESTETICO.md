# Plano Geral: Encaixe Estético Profissional & Motion Design do Fundo de Autenticação

**Data:** 10/10/2026  
**Objetivo:** Ajustar cirurgicamente a integração entre o fundo cartesiano/ondas com a tela principal de Login e Registro, eliminando o efeito de "bloco recortado colado" (patch escuro), refinando as curvas de motion design e garantindo um encaixe estético fluido, cinematográfico e profissional de fintech suíça (nível Stripe/Linear/TradingView institucional).  
**Protocolo:** Test-Driven Development (TDD) estrito, testes de estresse, caos e SSR em cada subetapa antes do avanço.

---

## 1. Squad de Especialistas & Skills Alocadas

| Papel | Agente | Skills Principais | Responsabilidade |
|---|---|---|---|
| **Líder & Orquestrador** | `tech-lead-orchestrator` | `01-project-context`, `20-conduzir-etapa` | Governança do plano, coordenação entre agentes e validação de gates |
| **Diretor de Design & Motion** | `chief-visual-director` (`designer-senior`) | `21-designer-senior-binmax`, `12-tokens-binmax` | Composição estética, eliminação de remendos, fusão de luz, física de movimento |
| **Desenvolvedor Frontend Cirúrgico** | `surgical-frontend-agent` (`cirurgiao`) | `17-mudanca-cirurgica`, `15-chave-sala-nova` | Edição com menor diff em `AuthShell.tsx`, `AuthBackgroundGridMotion.tsx`, `tokens-precision.css` |
| **Guardião de QA & Caos** | `qa-resilience-agent` | `06-testing-quality`, `05-resilience-patterns` | Criação e execução de testes de estresse SSR, caos de viewport, anti-cassino |
| **Revisor de Segurança** | `security-reviewer` | `04-security-iam`, `18-zonas-sensiveis` | Garantir isolamento de inputs sensíveis, zero interceptação de eventos no canvas |

---

## 2. Diagnóstico Visual da Falha de Encaixe Atual (Baseado na Captura do Usuário)

Na captura de tela enviada (`media_1791682864191_00b1d6f8.png`):
1. **O Patch Escuro Colado:** O elemento `.auth-left-panel` possui `backgroundColor: 'rgba(7, 13, 24, 0.72)'` e uma borda vertical direita `borderRight: 1px solid rgba(...)`, além de estar contido em um `maxWidth: 1440px; margin: 0 auto;`. Isso cria uma **caixa retangular maciça e escura** no centro-esquerda da tela, interrompendo abruptamente as linhas do grid cartesiano e as ondas luminosas.
2. **Falta de Profundidade Unificada (Canvas Contínuo):** Em vez de uma atmosfera imersiva única de trading onde os elementos flutuam com naturalidade, o usuário percebe três superfícies desconexas: as margens da janela, o bloco escuro da coluna esquerda e o card de login.
3. **Trajetória e Envergadura das Ondas de Motion:** As ondas atuais estão concentradas no rodapé inferior direito, deixando o centro da composição visualmente desequilibrado e vazio sob o bloco do mini-gráfico `Vol 50`.
4. **Ausência de Vinheta Perimétrica:** O fundo termina sem suavização nas bordas do viewport, gerando sensação de recorte.

---

## 3. Divisão do Plano em 5 Subetapas Sequenciais Rigorosas

- **Subetapa 01: Unificação do Canvas e Eliminação de Paredes Artificiais (`AuthShell.tsx`)**
  - Transformar `.auth-left-panel` em superfície transparente (`backgroundColor: 'transparent'`, `borderRight: 'none'`).
  - Permitir que o mini-gráfico `Vol 50`, os títulos e os badges flutuem organicamente sobre o grid de alta precisão.
  - Ajustar o header com transparência sutil e blur de vidro fumê (`rgba(7, 10, 15, 0.55)`), unificando todo o viewport.
  - *Gate de Teste:* Suíte unitária do `AuthShell` aprovando a nova estrutura sem regressões de conteúdo.

- **Subetapa 02: Refinamento Óptico do Grid Cartesiano & Vinheta de Profundidade (`AuthBackgroundGridMotion.tsx`)**
  - Implementar vinheta radial 360° em SVG para fade suave das linhas nas bordas extremas do monitor.
  - Linhas de alta definição de 1px com opacidade balanceada e micro-vértices luminosos verdes a cada 48px.
  - Glow volumétrico esmeralda tridimensional multicamada, ancorado na base do gráfico e no card fintech.
  - *Gate de Teste:* Testes unitários do componente visual SVG e estresse de montagem DOM.

- **Subetapa 03: Motion Design das Ondas de Trading de Escala Ampla (`AuthBackgroundGridMotion.tsx` + `tokens-precision.css`)**
  - Redesenhar as curvas vetoriais em escala panorâmica responsiva (`viewBox="0 0 1920 1080"`), com fluxo sinuoso que atravessa a tela harmonicamente.
  - Criação de 2 trajetórias de onda: primária luminosa com gradiente esmeralda neon (`#22C47A` a `#34D399`) e secundária com traço pontilhado suave de apoio técnico.
  - Animação `@keyframes bmWaveSinuous` com período de 16 segundos a 60 FPS com aceleração de física inercial (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Respeito irrestrito a `prefers-reduced-motion: reduce`.
  - *Gate de Teste:* Testes de animação, tokens de timing e validação anti-cassino.

- **Subetapa 04: Bateria Integrada de Testes de Estresse, Caos, Segurança e Viewport**
  - Execução de 150 ciclos combinados de renderização SSR da tela completa de autenticação em menos de 800ms.
  - Testes de caos de layout em 4 viewports extremas (2560px ultrawide, 1440px desktop, 1024px tablet, 375px mobile).
  - Teste de segurança: auditoria de não-interceptação de eventos (`pointerEvents: 'none'`) e integridade de formulários.
  - *Gate de Teste:* 100% dos testes aprovados no Vitest.

- **Subetapa 05: Build de Produção, Reinicialização do Dev Server e Homologação Final**
  - `pnpm --filter @broker/web build` (`tsc && vite build`) concluído com código 0.
  - Reinicialização limpa do Vite dev server na porta 5173.
  - Emissão do relatório de homologação e artefato executivo.
