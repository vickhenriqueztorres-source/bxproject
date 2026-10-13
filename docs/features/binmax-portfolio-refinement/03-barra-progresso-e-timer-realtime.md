# Subetapa 03 — Barra de Progresso Viva & Cronômetro Regressivo em Tempo Real

## 1. Objetivo Técnico
Adicionar interatividade dinâmica e tempo real aos cards de operações abertas, reproduzindo com fidelidade a área de progresso e tempo mostrada na imagem do usuário:
- **Barra de Progresso Horizontal**:
  - Trilho fino com altura de 3px a 4px, fundo `rgba(255, 255, 255, 0.1)`, cantos arredondados (2px).
  - Preenchimento proporcional ao tempo transcorrido:
    $$\text{progresso} = \min\left(100, \max\left(0, \frac{\text{agora} - \text{created\_at}}{\text{expires\_at} - \text{created\_at}} \times 100\right)\right)$$
  - Cor do preenchimento:
    - Verde menta (`#22C47A` / `#4ADE80`) para operações no lucro.
    - Prata/Branco neutro (`#E0E0E0` / `#FFFFFF`) para operações no prejuízo.
- **Cronômetro Regressivo Decrescente**:
  - Formato `mm:ss` (ex: `00:32`, `01:10`).
  - Fonte Geist Mono, 12.5px, bold, `#FFFFFF`.
  - Atualização automática e eficiente a cada 1 segundo (usando `requestAnimationFrame` ou timer amortecido).
- **Legenda de Expiração**:
  - Exibição de `Expira HH:mm:ss` (ex: `Expira 02:21:00`) abaixo do cronômetro com alinhamento à direita, cor `#8A92A1`, tamanho 10px.
- **Resiliência a Anomalias**:
  - Caso `now >= expires_at`, a barra fixa em 100% e o cronômetro exibe `00:00` (aguardando liquidação/settlement oficial).
  - Prevenção contra divisões por zero ou timestamps corrompidos.

---

## 2. Arquivos Impactados
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`

---

## 3. Testes Requeridos
- Teste unitário verificando o cálculo correto de porcentagem de progresso em diferentes instantes de tempo.
- Teste de formatação do cronômetro `mm:ss`.
- Teste de formatação do texto `Expira HH:mm:ss`.
- Teste de clamp (limites 0% e 100%) em contratos com tempo esgotado.
