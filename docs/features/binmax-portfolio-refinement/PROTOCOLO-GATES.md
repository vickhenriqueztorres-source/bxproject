# Protocolo de Gates — Refinamento Institucional do Portafolio

Este documento estabelece as regras invioláveis e critérios de liberação para cada subetapa da feature de refinamento do portafólio de operações.

---

## 1. Regra de Ouro: Bloqueio Sequencial Estrito

> **Nenhuma subetapa pode ser iniciada até que a anterior esteja 100% implementada, testada e com relatório de gate aprovado.**

Cada subetapa deve obrigatoriamente cumprir:
1. **Passo Cirúrgico**: Alterações apenas nos componentes autorizados, sem efeito colateral.
2. **Compatibilidade Regressiva**: Preservação de atributos e marcadores utilizados por testes prévios (`data-testid`, tags legadas ocultas para compatibilidade).
3. **Testes Dedicados**: Suíte unitária/integração validando os novos requisitos visuais e comportamentais.
4. **Relatório de Gate**: Gravação do relatório em `relatorios/XX-gate.md`.

---

## 2. Critérios de Aceitação por Subetapa

### Gate 01: Header Institucional & Abas
- [ ] Header em `SidebarDock.tsx` exibe "Portafolio total" em tipografia limpa, sem emoji 💼 no modo Binmax.
- [ ] Botão de fechamento ✕ estilizado no canto superior direito.
- [ ] Abas com seletor estilo underline (`Abiertas N` com indicador sublinhado ativo / `Cerradas` inativo).
- [ ] Navegação funcional entre as abas mantendo o estado interno.

### Gate 02: Card de Operações Abertas
- [ ] Card estilizado com fundo elevado `#171F2B`, bordas sutis e cantos arredondados (8px).
- [ ] Ícones de bandeiras duplas (`AssetFlagBadge`) e símbolo formatado em maiúsculas (`EUR/USD`).
- [ ] Badges sólidos de direção: `↑ ARRIBA` (verde `#22C47A`) e `↓ ABAJO` (vermelho `#F2545B`).
- [ ] Projeção de P&L em tempo real (`+$85.00` em verde ou `-$50.00` em vermelho com base no strike e preço atual).
- [ ] Identificação clara do valor investido (`Invertido $100`).

### Gate 03: Barra de Progresso e Cronômetro Realtime
- [ ] Barra horizontal de progresso com trilho e preenchimento animado proporcional ao tempo decorrido.
- [ ] Contagem regressiva `mm:ss` decrescente em tempo real a cada segundo via hook `useContractCountdown`.
- [ ] Carimbo de expiração formatado `Expira HH:mm:ss`.
- [ ] Resiliência a contratos expirados ou timestamps ausentes (clamp entre 0% e 100%).

### Gate 04: Aba "Cerradas" e Estado Vazio
- [ ] Lista de operações finalizadas renderizada com cards na mesma linguagem visual.
- [ ] Indicação de resultado de fechamento (`WIN` / `LOSS`), horário e lucro/prejuízo final.
- [ ] Estado vazio elegante com ícone de pasta e cópia em espanhol quando não há ordens abertas.

### Gate 05: Estresse, Caos e Segurança
- [ ] Teste de estresse: renderização de 100+ contratos com tempo de render < 10ms.
- [ ] Teste de caos: comportamento estável com relógio adiantado/atrasado, tick nulo e conexões instáveis.
- [ ] Teste de segurança: garantia de que nenhum valor financeiro é forjado no front-end e que não há mutação local de saldo.

### Gate 06: Certificação Integrada & Deploy
- [ ] 100% dos testes existentes verdes (507+ testes).
- [ ] Build de produção sem nenhum erro de tipagem TypeScript.
- [ ] Preview local ativo e testado.
- [ ] Deploy na VPS com serviços recarregados e smoke tests aprovados.
