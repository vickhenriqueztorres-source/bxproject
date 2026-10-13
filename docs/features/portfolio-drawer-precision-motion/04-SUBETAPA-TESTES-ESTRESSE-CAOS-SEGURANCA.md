# Subetapa 04: Bateria de Estresse, Caos, Segurança e Certificação Integrada

> **Módulo**: `PortfolioDrawer.tsx` e Integração com `TerminalLayout`  
> **Responsáveis**: `qa-resilience-agent`, `regression-guardian-agent`, `chief-visual-director`  
> **Status**: Aguardando Conclusão da Subetapa 03  

---

## 1. Objetivos da Certificação

1. **Bateria de Estresse de Alta Performance**:
   - Renderização maciça de 100 contratos abertos e 100 contratos fechados simultâneos.
   - Avaliação de tempo de ciclo de render (limite rígido < 200ms).
   - Teste de overflow e scroll virtual/suave no container de 220px.
2. **Bateria de Caos e Resiliência Front-End**:
   - Cliques ultra-rápidos e contínuos de alternância do drawer (`onToggle` chamado 50 vezes consecutivas).
   - Manipulação de dados extremos: contratos com timestamps passados, expirações zero, IDs longos, valores gigantes.
   - Ausência de quebra de layout quando `contracts = []`, `contracts = undefined` ou preços nulos.
3. **Bateria de Segurança e Invariantes Financeiros**:
   - Garantir que todos os valores exibidos venham de propriedades do contrato sem mutações de estado globais indevidas.
   - Higienização contra XSS em propriedades arbitrárias.
4. **Certificação de Não-Regressão**:
   - Execução integral de todos os 26 testes unitários existentes de portfólio e rodapé.
   - Teste do padrão Duas Portas (`isNewTraderoomEnabled() === false` preserva exatamente o modo clássico).

---

## 2. Critérios de Homologação Final (Gate de Aceite)

- [ ] Todas as 4 suítes de testes dedicadas passando 100% no Vitest.
- [ ] Todas as suítes legadas passando 100%.
- [ ] Checklist de 12 itens do `chief-visual-director` aprovado:
  - Zero emojis na barra de ferramentas.
  - Zero bordas verdes neon tipo cassino.
  - Empty state com micro-ilustração vetorial sóbria.
  - Tipografia estrita em Geist Sans e Geist Mono tabular.
  - Motion suave com tokens institucionais (`--bm-ease`, 180ms/260ms).
