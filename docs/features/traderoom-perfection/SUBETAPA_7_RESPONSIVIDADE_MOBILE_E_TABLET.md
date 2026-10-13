# SUBETAPA 7: EXPERIÊNCIA RESPONSIVA MOBILE & TABLET

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `iq-fidelity-reviewer`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Skills Aplicadas:** `12-tokens-binmax`, `13-textos-es`, `14-teste-de-sobreposicao`, `17-mudanca-cirurgica`

---

## 1. Objetivo Visual e Ergonômico
Adaptar toda a experiência do Traderoom para smartphones e tablets em estrita conformidade com a **Imagem 2**:

1. **Cabeçalho Mobile Superior:**
   - Botão de menu hambúrguer `☰` para acesso à navegação institucional.
   - Logo `BINMAX` vetorizado com proporção reduzida (~24px).
   - Avatar do usuário e seletor compacto de conta: `Cuenta real` com saldo verde `$9,603.75`.
   - Botão `Depositar` compacto com cantos arredondados.
2. **Barra de Abas de Ativos Mobile:**
   - Rolagem horizontal fluida (touch scroll com momentum e `scrollbar-width: none`).
   - Abas com bandeiras circulares e texto `Turbo` preservados.
3. **Sub-barra Superior do Gráfico:**
   - Seletor do ativo ativo, botões de troca rápida entre velas e linhas, ícone de informações e favoritos.
   - Contador de tempo de compra `HORA DE COMPRA 00:08` fixado no canto superior direito do gráfico.
4. **Gráfico Central Touch Otimizado:**
   - Suporte a pinch-to-zoom e arraste lateral (pan) touch sem scroll acidental da página.
   - Traders Mood Bar em diamantes compactados no canto esquerdo.
5. **Boleta de Ordens Inferior em Grade (2 Linhas):**
   - **Linha 1:** Dois blocos lado a lado: `Monto (?) − $ 100 +` e `Expiración (?) − 00:21 +`.
   - **Linha 2:** Bloco de `Ganancia (?) +85% +$85.00` à esquerda; Botão gigante `SUBE` (verde) e Botão gigante `BAJA` (vermelho) à direita.
   - Alvos de toque estritamente $\ge 44\text{px}$ para operação sem erro no celular.
6. **Barra de Navegação Inferior (Mobile Bottom Dock):**
   - Dock fixo na base da tela com 5 abas principais:
     - `Operar` (ativa com ícone de gráfico)
     - `Portafolio`
     - `Historial`
     - `Torneos`
     - `Más` (`•••`)
   - Respeito à área segura dos smartphones modernos (`env(safe-area-inset-bottom)`).

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/components/layout/MobileTraderoomLayout.tsx` (Novo layout especializado para viewports móveis).
- `apps/web/src/components/navigation/MobileBottomNav.tsx` (Barra de navegação inferior com 5 abas).
- `apps/web/src/styles.css` (Media queries `@media (max-width: 767px)` e `@media (min-width: 768px) and (max-width: 1024px)`).
- `apps/web/src/trade/responsive-perfection.unit.test.ts` (Testes automatizados da suite mobile).

### 2.2 O que Muda
- Em telas menores que 768px, o layout transmuta automaticamente para a disposição móvel da Imagem 2.
- A dock lateral esquerda é oculta e suas opções migram para o menu hambúrguer e a barra inferior.
- O ticket de ordens passa a ocupar a área inferior dividida em 2 linhas de alta ergonomia.

### 2.3 O que NÃO Muda
- A engine do gráfico e os hooks de trade (`useFeed`, `openContract`, `useTickPulse`) são exatamente os mesmos, sem duplicação de lógica.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Renderização dos elementos do cabeçalho mobile, barra inferior e grade de ticket em viewport de 375x667 (iPhone SE) e 390x844 (iPhone 14).
- Alvos de clique possuem altura mínima de 44px e largura mínima de 44px.

### 3.2 Testes de Estresse
- Rotação de tela (portrait para landscape e vice-versa) com redimensionamento de canvas instantâneo sem perda de estado do gráfico.

### 3.3 Testes de Caos
- Toque simultâneo em dois botões (multi-touch): bloqueio defensivo de submissão dupla.
- Scroll vertical travado na viewport do gráfico para evitar "bounce" involuntário do navegador.

### 3.4 Testes de Segurança
- Garantia de que nenhuma ação de trade ocorra fora da intenção do usuário por toques fantasma.

### 3.5 Testes de Regressão
- A versão desktop acima de 1024px permanece inalterada e sem vazamento de estilos mobile.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Layout mobile 100% fiel à Imagem 2.
2. Botões SUBE e BAJA com alvos ergonômicos e resposta tátil.
3. Barra inferior de 5 abas funcional.
4. `responsive-perfection.unit.test.ts` 100% verde.
