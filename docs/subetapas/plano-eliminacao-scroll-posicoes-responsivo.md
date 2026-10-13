# Plano Geral: Eliminação de Scrollbar e Responsividade 100% Encaixada das Boletas com Tabela de Posições Aberta (BINMAX)

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agentes Convocados**:  
> - `chief-visual-director` / `designer-senior-binmax` (Direção de Arte, Ergonomia Visual, Eliminação de Scrollbars Nativas e Instrumento de Precisão)  
> - `surgical-frontend-agent` (Implementação Cirúrgica em `apps/web/src/trade/**`, `apps/web/src/chart/**` e `styles.css`)  
> - `chart-trading-engineer` (Geometria e Encaixe de Células no `MultiChartGrid`)  
> - `qa-resilience-agent` (Baterias de Testes de Estresse de Altura, Caos de Redimensionamento e Ausência de Overflow)  
> - `compliance-risk-reviewer` (Integridade de Invariantes Financeiras, Prevenção de Duplo Disparo e Validação de Stake sob Boleta Compacta)  
> - `regression-guardian-agent` (Validação de Não-Regressão e Execução Completa da Suíte Vitest)  
>  
> **Skills Ativadas**:  
> - `01-project-context` (Contexto de Arquitetura e Monorepo)  
> - `12-tokens-binmax` (Tokens Turbo Prata e Superfícies Noche/Panel)  
> - `17-mudanca-cirurgica` (Protocolo de Menor Diff Possível e Sem Efeitos Colaterais)  
> - `21-designer-senior-binmax` (Instrumento de Precisão, Escala de Espaçamento 4/8/12/16px e Fim de Scrollbars Nativas Feias)  
> - `06-testing-quality` (Pirâmide de Testes, Testes de Caos e Estresse)  
> - `19-testes-de-regressao-visual` (Garantia de Fidelidade e Estabilidade)  

---

## 1. Diagnóstico Forense do Defeito

### Evidência Visual & Causa Raiz
1. **Evidência Visual Capturada**:
   - Em layouts multi-gráfico (ex: grid 2x2) ou com resolução de tela compacta, ao abrir a tabela/gaveta de posições ("Mostrar posiciones" via `PortfolioDrawer` ocupando ~250px no rodapé), surge uma **barra de rolagem vertical cinza/branca nativa do Windows com setas** espremendo o lado direito de cada boleta (`OrderTicket`).
   - A barra nativa de 16px comprime a largura da boleta de 144px para apenas 128px, deformando botões, desalinhando rótulos e quebrando a estética profissional de instrumento de precisão da BINMAX.

2. **Causa Raiz Técnica**:
   - **`MultiChartGrid.tsx` (linhas 252-265)**: O container `[data-testid="cell-order-ticket-${symbol}"]` possui `overflowY: 'auto'` com largura fixa de `144px` e nenhum estilo de scrollbar customizada/stealth.
   - **`OrderTicket.tsx`**: O conteúdo em modo `isCompact={true}` possui soma de alturas fixas rígidas:
     - Bloco Monto: ~80px (label + input 36px + 4 presets 24px)
     - Bloco Expiración: ~51px (label + stepper 36px)
     - Bloco Ganancia: ~55px (label + +85% + lucro)
     - Botões SUBE e BAJA: 2 × 42px = 84px
     - Gaps e paddings: ~32px
     - **Altura total mínima rígida**: ~302px.
   - **Conflito de Altura (Collision)**: Quando o `PortfolioDrawer` abre ocupando 220px + 30px bar = 250px no rodapé, a altura disponível para as células em um grid 2x2 cai para ~230px–260px. Como 302px > 250px, o browser dispara imediatamente a barra de rolagem nativa vertical do Windows.
   - Se aplicássemos apenas `overflow: hidden`, os botões SUBE/BAJA seriam cortados da tela, impossibilitando operações.
   - **Solução de Precisão Requerida**: 
     1. Tornar o `OrderTicket` **responsivo e elástico verticalmente**, adaptando dinamicamente gaps, alturas de campos, tipografia e botões para que caiba perfeitamente (100% encaixado) mesmo em células compactas de 220px a 270px de altura.
     2. Aplicar scrollbars stealth invisíveis (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar { display: none }`) e proteção contra qualquer overflow intrusivo.
     3. Calibrar a gaveta `PortfolioDrawer` para altura adaptativa (`clamp(150px, 20vh, 220px)`), garantindo respiração e ergonomia simultânea do gráfico, da boleta e da tabela de posições.

---

## 2. Divisão do Plano em Subetapas Sequenciais e Estritas

O plano é dividido em **3 Subetapas Independentes e Progressivas**. Nenhuma subetapa será avançada sem que a anterior esteja 100% implementada, testada e validada com suítes automatizadas verdes.

```
+---------------------------------------------------------------------------------------+
| SUBETAPA 01: Boleta Elástica e Responsiva Verticalmente (OrderTicket 100% Encaixado)  |
| - Sistema de dimensionamento adaptativo (fluid spacing) no OrderTicket compacto:       |
|   * Gaps verticais dinâmicos/compactos (2px a 4px sob restrição de altura)            |
|   * Steppers de Monto e Expiración com altura calibrada (28px a 34px)                 |
|   * Linha de presets 10/50/100/500 otimizada (altura 20px–22px, padding refinado)     |
|   * Bloco Ganancia ultra-compacto com tipografia tabular escalonada                   |
|   * Botões SUBE e BAJA elásticos (height 34px a 40px) preservando touch/click targets  |
| - Total de altura do ticket compacto reduzido de >302px para <=240px sem perda visual|
| - Testes: Bateria de testes unitários com restrição de altura (230px, 250px, 280px)   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| SUBETAPA 02: Eliminação do Scrollbar Feio & Integração Multi-Gráfico + Drawer Aberto  |
| - Eliminação total de scrollbars nativas do Windows no MultiChartGrid e TerminalLayout|
| - Inclusão de regras stealth scrollbar no CSS (.cell-order-ticket, .terminal-order-dock)|
| - Calibração de altura elástica do PortfolioDrawer (clamp responsivo)                  |
| - Garantia de que a abertura de "Mostrar posiciones" não gera scroll em nenhum chart  |
| - Testes: Teste de estresse com MultiChartGrid 2x2 + Drawer aberto + verificação      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| SUBETAPA 03: Bateria de Certificação, Estresse, Caos, Segurança e Não-Regressão        |
| - Teste de Caos: 50 cliques sequenciais em SUBE/BAJA na boleta compacta (sem drift)   |
| - Teste de Segurança: Validação de que stakeMinor e expiração permanecem invioláveis  |
| - Teste de Estresse de Resoluções: Verificação em viewports 1366x768, 1920x1080 e 4K  |
| - Validação de Não-Regressão: Execução de 100% da suíte Vitest do projeto             |
+---------------------------------------------------------------------------------------+
```

---

## 3. Especificação Passo a Passo de Cada Subetapa

### SUBETAPA 01: Boleta Elástica e Responsiva Verticalmente (`OrderTicket`)
- **Arquivos-alvo**: `apps/web/src/trade/OrderTicket.tsx`
- **Ações**:
  1. No modo `isCompact={true}` do `OrderTicket`:
     - Reduzir `ticketGap` para `clamp(2px, 0.4vh, 4px)`.
     - Calibrar `fieldHeight` para `clamp(28px, 3.8vh, 34px)`.
     - Calibrar `stepperBtnWidth` para `28px`.
     - Calibrar `btnHeight` dos botões SUBE/BAJA para `clamp(32px, 4.8vh, 38px)`.
     - Presets `[10, 50, 100, 500]`: altura reduzida de 24px para `20px`, fonte `10.5px`.
     - Bloco `Ganancia`: margem superior de 1px, percentual `18px`, valor `11.5px`.
     - Inclusão de propriedade `box-sizing: border-box` e `overflow: hidden` no wrapper do ticket compacto.
- **Critério de Aceite da Subetapa 01**:
  - A boleta compacta cabe perfeitamente em um container com altura de 240px sem estourar e sem necessitar de barra de rolagem.
  - Todos os elementos (Monto, Presets, Expiración, Ganancia, SUBE, BAJA) continuam visíveis, alinhados e totalmente operacionais.
  - Bateria de testes unitários dedicada criada e 100% verde.

---

### SUBETAPA 02: Eliminação do Scrollbar Feio & Integração Multi-Gráfico + Drawer Aberto
- **Arquivos-alvo**: 
  - `apps/web/src/chart/MultiChartGrid.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/components/drawer/PortfolioDrawer.tsx`
- **Ações**:
  1. No `MultiChartGrid.tsx`:
     - No container `data-testid="cell-order-ticket-${symbol}"`:
       - Adicionar classe `bm-stealth-scroll`.
       - Ajustar estilo inline para: `overflowY: 'hidden'` (com fallback stealth para não permitir barra feia do Windows).
       - Ajustar padding para `4px 3px` para maximizar o espaço útil vertical.
  2. No `styles.css`:
     - Adicionar estilos para ocultar barra de rolagem nativa em `.theme-binmax .terminal-order-dock` e nas boletas acopladas de multi-gráfico:
       ```css
       .theme-binmax .cell-order-ticket-container,
       .theme-binmax [data-testid^="cell-order-ticket-"],
       .theme-binmax .terminal-order-dock {
         scrollbar-width: none !important;
         -ms-overflow-style: none !important;
       }
       .theme-binmax .cell-order-ticket-container::-webkit-scrollbar,
       .theme-binmax [data-testid^="cell-order-ticket-"]::-webkit-scrollbar,
       .theme-binmax .terminal-order-dock::-webkit-scrollbar {
         display: none !important;
         width: 0 !important;
         height: 0 !important;
       }
       ```
  3. No `PortfolioDrawer.tsx`:
     - Calibrar a altura do conteúdo expandido da gaveta para `clamp(160px, 22vh, 210px)` em vez de fixo em 220px rígidos, liberando altura crítica para os gráficos e boletas em viewports menores.
- **Critério de Aceite da Subetapa 02**:
  - Em qualquer layout do `MultiChartGrid` (1x1, 2x1, 1x2, 2x2), com o drawer "Mostrar posiciones" aberto ou fechado, NENHUM scrollbar nativo surge nas boletas.
  - O layout se mantém 100% encaixado e responsivo.
  - Bateria de testes automatizados criada e 100% verde.

---

### SUBETAPA 03: Certificação Integrada, Caos, Segurança Invariante e Não-Regressão
- **Arquivos-alvo**: 
  - Criação de suíte de testes de estresse e caos: `apps/web/src/chart/subetapa-boleta-encaixe-responsivo-chaos.unit.test.tsx`
- **Ações**:
  1. Teste de Estresse de Resolução (Alturas extremas: 200px, 240px, 260px, 300px, 400px).
  2. Teste de Caos de Disparo: Simulação de 10 ordens simultâneas em células distintas com ticket compacto.
  3. Teste de Segurança Financeira: Conferir que o `parseStakeInput`, seleção de presets e envio de stake minor continuam exatos e sem mutação indevida.
  4. Execução de toda a suíte de testes vitest do projeto para garantir zero regressão.
- **Critério de Aceite da Subetapa 03**:
  - Todas as suítes passam com 100% de sucesso.
  - Relatório de validação gerado com evidências.

---

## 4. Invariantes Invioláveis Garantidos
1. **Preservação de Dinheiro**: O stake em minor fraction (centavos USD) nunca sofre arredondamento ou corte por efeitos de estilização.
2. **Prevenção de Duplo Disparo**: Os botões SUBE e BAJA mantêm seus bloqueios de segurança (`busy`, `blocked`, `feed stale`, `paused`).
3. **Ergonomia e Fidelidade IQ/Binmax**: Zero perda de contraste, tipografia oficial Geist Mono preservada e feedback tátil impecável.
