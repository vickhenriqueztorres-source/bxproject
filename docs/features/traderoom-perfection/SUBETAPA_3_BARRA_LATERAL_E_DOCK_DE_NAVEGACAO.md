# SUBETAPA 3: BARRA LATERAL DOCK E NAVEGAÇÃO INSTITUCIONAL

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `iq-fidelity-reviewer`, `binmax-brand-agent`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Skills Aplicadas:** `12-tokens-binmax`, `13-textos-es`, `14-teste-de-sobreposicao`, `17-mudanca-cirurgica`

---

## 1. Objetivo Visual e Funcional
Substituir a barra lateral simplificada pela suíte de navegação vertical completa demonstrada na **Imagem 1** e **Imagem 3**:
1. **Dock Vertical Alinhado à Esquerda:**
   - Largura fixa de ~68px.
   - Itens ordenados na vertical:
     - `Operar` (Ícone de gráfico com candle, estado ativo com indicador vertical ciano e luz de fundo).
     - `Portafolio` (Ícone de pasta/maleta, exibindo badge com número de ordens ativas).
     - `Historial` (Ícone de relógio).
     - `Torneos` (Ícone de troféu).
     - `Análisis` (Ícone de gráfico de barras com lupa).
     - `Tutoriales` (Ícone de capelo / graduação).
     - `Promociones` (Ícone de caixa de presente).
     - Na extremidade inferior: `Ajustes` (Ícone de engrenagem).
2. **Microcopy Oficial em Espanhol:**
   - Textos exatos em caixa baixa/alta harmonizada: `Operar`, `Portafolio`, `Historial`, `Torneos`, `Análisis`, `Tutoriales`, `Promociones`, `Ajustes`.
3. **Comportamento Interativo:**
   - Clicar em cada aba abre seu respectivo Drawer lateral ou modal sem interferir na renderização de 60 FPS do gráfico principal.

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/components/sidebar/SidebarDock.tsx` (Atualização completa da lista de ícones e estados ativos).
- `apps/web/src/components/sidebar/SidebarIcons.tsx` (Ícones SVG limpos e otimizados baseados no Lucide/IQ Option).
- `apps/web/src/styles.css` (Regras de hover, active pill ciano e transições suaves de 150ms).
- `apps/web/src/trade/sidebar.unit.test.ts` (Testes automatizados da barra lateral).

### 2.2 O que Muda
- Adição dos itens ausentes (`Torneos`, `Tutoriales`, `Promociones`, `Ajustes`) com seus respectivos SVGs.
- Tratamento ergonômico de clique e foco para teclado (A11y).
- Alinhamento do ícone de ajustes no rodapé do dock lateral.

### 2.3 O que NÃO Muda
- Os fluxos de dados de posições ativas (`contracts.data`) continuam alimentando o contador de contratos sem alteração de polling.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Renderização de todos os 8 itens com seus textos e ícones correspondentes.
- Verificação do estado ativo visual quando a rota ou tab selecionada for `Operar`, `Portafolio`, etc.
- Atualização dinâmica da badge de contratos abertos em `Portafolio`.

### 3.2 Testes de Estresse
- Alternância rápida entre abas (50 cliques em 5 segundos) sem retenção de nós de DOM em memória ou vazamento de event listeners.

### 3.3 Testes de Caos
- Abertura simultânea de gavetas e redimensionamento de janela (1920px -> 600px -> 1920px) garantindo recolhimento automático da barra em viewports mobile sem crash.

### 3.4 Testes de Segurança
- Prevenção de injeção de HTML em tooltips ou rótulos de navegação.

### 3.5 Testes de Regressão
- Garantia de que atalhos de teclado (ex: `Escape` para fechar gavetas) continuam funcionando sem afetar a digitação no ticket de ordem.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Dock idêntico à Imagem 1 com 8 itens posicionados e estilizados com tokens Turbo Prata.
2. Badge de ordens abertas sincronizado com o total real de contratos.
3. Teste `sidebar.unit.test.ts` 100% verde.
