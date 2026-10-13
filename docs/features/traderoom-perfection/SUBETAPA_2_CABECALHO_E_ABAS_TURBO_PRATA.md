# SUBETAPA 2: CABEÇALHO TURBO PRATA, ABAS COM BANDEIRAS E SELETOR DE CONTA

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `iq-fidelity-reviewer`, `binmax-brand-agent`, `compliance-risk-reviewer`, `surgical-frontend-agent`  
> **Skills Aplicadas:** `12-tokens-binmax`, `13-textos-es`, `14-teste-de-sobreposicao`, `15-chave-sala-nova`, `17-mudanca-cirurgica`

---

## 1. Objetivo Visual e Funcional
Aproximar o cabeçalho superior (Header) 100% da **Imagem 1** e **Imagem 2**:
1. **Identidade Turbo Prata:** Logo Binmax com duplo chevron cromado e texto `BINMAX` em tipografia Archivo de alta legibilidade.
2. **Ícone de Multi-Gráficos:** Botão com grid de 4 quadrados (`[::]`) ao lado do logo para alternância rápida de layout.
3. **Abas de Ativos Institucionais com Bandeiras:**
   - Cada aba de par de moedas exibe **duas bandeiras nacionais circulares sobrepostas** (ex: Nova Zelândia e Japão para `NZD/JPY`, Europa e EUA para `EUR/USD`, Europa e Canadá para `EUR/CAD`, Reino Unido e Japão para `GBP/JPY`).
   - Texto de subtítulo em cinza aço: `Turbo`.
   - Aba ativa com borda sutil ciano/azul e realce de fundo.
   - Botão de fechar `×` discreto em hover.
   - Botão `+` para abrir o catálogo explorer de ativos.
4. **Perfil e Seletor de Saldo:**
   - Avatar circular de usuário com ícone neutro.
   - Dropdown de conta (`Cuenta real` / `Cuenta práctica`) com seta para baixo.
   - Saldo exibido em verde vivo (`#22C47A` / `$9,603.75`) com fonte tabular Geist Mono.
5. **Botão de Depósito:**
   - Botão retangular com cantos arredondados, ícone de carteira/cartão e texto `Depositar`, com fundo verde escuro e borda verde neon suave.

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/components/header/TerminalHeader.tsx` (Reestruturação do cabeçalho de acordo com a Imagem 1).
- `apps/web/src/components/header/AssetFlagBadge.tsx` (Novo componente vetorizado com bandeiras circulares para pares Forex e ícones para Cripto/Sintéticos).
- `apps/web/src/components/header/AccountSelectorDropdown.tsx` (Dropdown de conta Real vs Demo com saldo em destaque e recarga instantânea de US$ 10.000).
- `apps/web/src/styles.css` (Estilos específicos da classe `.theme-binmax .terminal-header` e animação de glow ciano).
- `apps/web/src/trade/header.unit.test.ts` (Testes automatizados do novo cabeçalho).

### 2.2 O que Muda
- Substituição do botão rústico `CONTA PRÁTICA US$ 10.000,00 ↺` pelo seletor institucional com avatar e dropdown.
- Renderização visual das bandeiras nacionais nas abas em vez de texto cru `SYNTH_VOL_50 [+85%]`.
- Botão Depositar com o novo estilo da Imagem 1.

### 2.3 O que NÃO Muda
- A fonte de saldo continua sendo estritamente o endpoint `/api/wallet` e eventos de WebSocket `wallet_balance`.
- O valor é sempre formatado a partir de inteiros `available_minor` via `formatMinor`.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Renderização de bandeiras para todos os pares principais do catálogo (`EURUSD`, `GBPJPY`, `NZDJPY`, `USDCAD`, etc.) com fallbacks seguros para índices sintéticos.
- Alternância de abas: clicar em uma aba chama `onSelectTab` com o símbolo correspondente.
- Fechamento de abas: fechar a aba ativa redireciona suavemente para a primeira aba restante sem falhas de estado.

### 3.2 Testes de Estresse
- Renderização de 12 abas simultâneas com scroll horizontal suave mantendo alinhamento sem quebra de layout em resoluções de 1280x720 a 3840x2160.

### 3.3 Testes de Caos
- Recebimento de saldo com valor nulo, zero ou indefinido: o seletor exibe carregando sem gerar crash do componente.
- Injeção de caracteres especiais no nome da conta: sanitização XSS estrita.

### 3.4 Testes de Segurança
- Impossibilidade de manipular o saldo exibido no dropdown: qualquer valor alterado via devtools não reflete no estado de envio da ordem.

### 3.5 Testes de Regressão
- Com a feature flag `NEW_TRADEROOM = false`, o cabeçalho original da versão legada permanece intacto.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Cabeçalho idêntico à Imagem 1 com tolerância geométrica ≤ 5px.
2. Abas com bandeiras circulares nítidas em SVG puro (sem imagens externas quebradas).
3. Saldo verde formatado perfeitamente.
4. Teste `header.unit.test.ts` passando com 100% de sucesso.
