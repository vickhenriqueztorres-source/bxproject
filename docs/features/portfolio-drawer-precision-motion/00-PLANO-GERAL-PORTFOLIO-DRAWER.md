# Plano Mestre: Modernização e Motion Design de Alta Precisão do Portfolio Drawer (BINMAX)

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agentes Convocados**:  
> - `chief-visual-director` / `designer-senior-binmax` (Direção de Arte, Motion Design e Instrumento de Precisão)  
> - `frontend-realtime-agent` / `surgical-frontend-agent` (Implementação Cirúrgica exclusiva em `apps/web`)  
> - `qa-resilience-agent` / `regression-guardian-agent` (Engenharia de Testes, Estresse, Caos e Não-Regressão)  
> - `binmax-brand-agent` (Governança de Tokens Turbo Prata e Tipografia Geist)  
>
> **Skills Ativadas**:  
> - `21-designer-senior-binmax`  
> - `12-tokens-binmax`  
> - `13-textos-es`  
> - `17-mudanca-cirurgica`  
> - `19-testes-de-regressao-visual`  
> - `06-testing-quality`  
> - `01-project-context`  

---

## 1. Diagnóstico Forense do Problema 1

### Evidência Visual da Tela
Na interface capturada pelo usuário, o painel inferior retrátil do traderoom (`PortfolioDrawer`) apresenta um aspecto amador e desconectado da linguagem institucional da BINMAX:
1. **Barra Fixa Superior Rude**: Uso de emoji unicode cru (`💼`), badge verde plano sem refinamento e botão de expansão com texto simples e setas unicode cruas (`Mostrar posiciones ⌃ / ⌵`).
2. **Corte Seco de Abertura/Fechamento**: Ausência total de animação fluida; a abertura salta instantaneamente de 0px para 220px, violando os tokens de física de movimento da plataforma.
3. **Abas com Borda Verde Neon**: Botões de abas com estilo de cassino (`border: 1px solid #22C55E`, fundo verde transparente), violando a Lei 3 ("Cor como Significado, Nunca Decoração") e a Lei 5 ("Profundidade com Luz, Não com Linhas").
4. **Empty State Amador**: Um único texto centralizado flutuando no vazio escuro (`Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.`), sem micro-ilustração vetorial técnica, sem hierarquia tipográfica e sem contexto de suporte.
5. **Tabelas Operacionais Rudimentares**: Tabela HTML clássica com espaçamentos rígidos, falta de alinhamento com tokens de superfície e transições de hover ásperas.

### Diretriz Central do Designer Sênior
> $$\mathbf{\text{“A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO.”}}$$

O painel deve evocar um terminal de trading profissional de alta densidade (padrão Bloomberg / TradingView / IQ Option Pro), com superfícies de profundidade (`--bg-0: #0B0E14`, `--bg-1: #101622`, `--bg-2: #151D2B`, `--bg-3: #1C2738`), curvas de movimento mecânicas (`--bm-ease: cubic-bezier(0.16, 1, 0.3, 1)`), Geist Sans para interface e Geist Mono para números tabulares (`tabular-nums`).

---

## 2. Divisão em 4 Subetapas Sequenciais

Nenhuma subetapa é implementada sem testes prévios ou sem 100% de validação da subetapa anterior.

```
+-----------------------------------------------------------------------------------+
| SUBETAPA 01: Barra de Controle & Motion de Deslize Mecânico                       |
| - Substituição do emoji 💼 por ícone vetorial SVG refinado (pasta/ordens 1.5px)   |
| - Badge de posições com dot luminoso e numerais Geist Mono                        |
| - Botão retrátil com chevron SVG giratório suave (180ms cubic-bezier)             |
| - Transição mecânica de abertura/fechamento suave (260ms) sem layout pop          |
| - Testes: Unitários + Estresse de Renderização + Preservação de Testes Legados    |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| SUBETAPA 02: Abas Segmentadas Institucionais & Empty States de Precisão           |
| - Extinção de bordas verdes neon nas abas (Segmented Control institucional)       |
| - Indicador ativo com background tonal `--bg-3` e texto branco nítido             |
| - Empty State de ordens abertas com SVG vetorial, hierarquia H3 + P + dica técnica|
| - Empty State de histórico fechado com consistência visual                        |
| - Testes: Acessibilidade ARIA + Testes de Estados Vazios + Validação de Tokens    |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| SUBETAPA 03: Grid de Dados Operacionais em Tempo Real & Histórico                 |
| - Cabeçalhos tabulares alinhados com tokens de tipografia técnica                 |
| - Identificação de ativos com bandeiras de moedas (`AssetFlagBadge`)              |
| - Badges de direção SUBE/BAJA sóbrios em `--profit` e `--loss`                    |
| - Cronômetro Geist Mono tabular e barra de progresso animada com suavidade        |
| - Micro-interação de hover em linhas com iluminação de superfície sutil           |
| - Testes: Formatação Monetária + Delta de Preços + Integridade de Payouts         |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| SUBETAPA 04: Bateria de Estresse, Caos, Segurança e Certificação Integrada        |
| - Teste de Estresse: 100 ordens simultâneas em < 150ms sem memory leak            |
| - Teste de Caos: Spam de toggle (50 cliques rápidos), alternância rápida de abas  |
| - Teste de Segurança: Prevenção de XSS e integridade de imutabilidade financeira   |
| - Certificação de Não-Regressão: 100% das 26 suítes existentes verdes             |
+-----------------------------------------------------------------------------------+
```

---

## 3. Matriz de Segurança e Não-Regressão
- **Fronteira Estrita**: Nenhuma linha de código no backend (`services/**`, `db/**`, `infra/**`) será tocada.
- **Padrão Duas Portas**: Se `isNewTraderoomEnabled() === false`, o comportamento legado é preservado intacto.
- **Invariantes Financeiros**: Valores de ordens, stakes e payouts são formatados exclusivamente com funções puras de `lib/money.ts`. Nenhum cálculo manipulador no cliente.
