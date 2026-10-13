# Plano Mestre de Engenharia: Redesign do Fundo de Autenticação e Popup de Torneios

**Plataforma**: BINMAX — Terminal de Índices Sintéticos de Alta Precisão  
**Orquestrador**: `tech-lead-orchestrator`  
**Escopo**: Exclusivamente Frontend (`apps/web/**`)  
**Data**: Outubro de 2026  
**Status**: Aprovado para Execução Sequencial  

---

## 1. Seleção de Agentes e Skills

| Agente Especializado | Skills Chave | Responsabilidade Principal |
| :--- | :--- | :--- |
| **`tech-lead-orchestrator`** | `01-project-context`, `20-conduzir-etapa` | Coordenação geral, governança das regras invioláveis, verificação dos gates de avanço entre subetapas. |
| **`chief-visual-director`** (`designer-senior`) | `21-designer-senior-binmax`, `12-tokens-binmax` | Análise estética profunda, harmonia cromática de superfícies (`#0B0E14`, `#101622`, `#151D2B`), motion design sem ruído e direção de arte dos cards e tabelas de torneio. |
| **`frontend-realtime-agent`** / **`cirurgiao`** | `17-mudanca-cirurgica`, `15-chave-sala-nova` | Implementação cirúrgica dos componentes React + TS com menor diff possível, sem alterar APIs e com isolamento estrito. |
| **`qa-resilience-agent`** | `06-testing-quality` | Criação de suítes de testes unitários, testes de estresse (100+ renders em <800ms), testes de caos (dados anômalos) e testes de segurança (XSS/BOLA no front). |
| **`compliance-risk-reviewer`** | `02-financial-invariants`, `18-zonas-sensiveis` | Garantia de isolamento financeiro (saldo demo/torneio separado de conta real, integridade de regras e ausência de manipulação local). |
| **`regression-guardian-agent`** | `19-testes-de-regressao-visual` | Blindagem retroativa: assegura que nenhuma funcionalidade do traderoom ou rotas secundárias seja danificada. |

---

## 2. Visão Geral dos Objetivos

### Parte A: Harmonização e Motion Design do Fundo de Login & Registro
1. **Problema**: O fundo da tela de login e registro apresentava descompasso cromático e estético em relação ao terminal principal (uso de `#070A0F` cru em vez da paleta institucional de superfícies `--bg-0: #0B0E14` / `--bg-1: #101622` / `--bg-2: #151D2B`). O card parecia um "bloco colado" com contraste duro sobre um grid rígido.
2. **Solução Sênior UX/UI & Motion**:
   - Ajustar a base para `#0B0E14` com transição radial volumétrica suave em tons de ardósia e aura esmeralda institucional (`rgba(34, 196, 122, 0.05)`).
   - Aplicar máscara de desvanecimento 360° no SVG do grid cartesiano 48px para eliminar cortes bruscos nas bordas.
   - Refinar a física de movimento das ondas financeiras com interpolação `cubic-bezier(0.16, 1, 0.3, 1)` a 60 FPS, respeitando `prefers-reduced-motion`.
   - Elevar o acabamento de `.bm-card-fintech` com superfície glassmorphic acetinada (`linear-gradient(180deg, #101622 0%, #0B0E14 100%)`) e borda com reflexo superior de 10% de luz branca.

### Parte B: Popup de Torneios de Alta Fidelidade (Imagens 1 e 2)
1. **Acionamento**: Ao clicar no item "Torneios" na barra lateral de navegação (`SidebarDock`) ou acessar `/torneos`, abre um modal popup refinado, responsivo e com backdrop escurecido e desfocado (`backdrop-filter: blur(10px)`).
2. **Visão 1: Grade de Torneios (Imagem 1)**:
   - Header com título `Torneios`, subtítulo explicativo e badge `Torneios semanais / Novos torneios toda segunda-feira.`.
   - 5 cards com design de precisão:
     - **Copa BINMAX**: Destaque com borda verde esmeralda neon (`#22C47A`), badge `● AO VIVO`, contador regressivo `Termina em 22:51:55`, ilustração do troféu cibernético, prêmio `R$ 2.500`, `1.248 participantes`, botão `Participar →` (verde sólido com texto escuro).
     - **Desafio da Semana**: Badge `EM BREVE`, `Começa em 1d 09h 51m`, troféu prateado, prêmio `R$ 1.000`, botão `Ver detalhes`.
     - **Mestres dos Sintéticos**: Badge `EM BREVE`, `Começa em 3d 18h 51m`, troféu bronze/âmbar, prêmio `R$ 3.000`, botão `Ver detalhes`.
     - **Desafio Express**: Badge `ENCERRADO`, `Encerrou em 03 de out.`, troféu monocromático, prêmio `R$ 800`, botão `Ver resultado`.
     - **Campeões do Mês**: Badge `ENCERRADO`, `Encerrou em 30 de set.`, troféu monocromático, prêmio `R$ 5.000`, botão `Ver resultado`.
3. **Visão 2: Painel Detalhado de 3 Colunas (Imagem 2)**:
   - Abertura ao clicar em "Participar", "Ver detalhes" ou "Ver resultado".
   - **Coluna 1 (Regras e Visão Geral)**: Badge de status, contador de tempo com ícone de relógio, título, subtítulo verde, parágrafo de regras e tabela de especificações (Período, Depósito, Ativos, Classificação, Mínimo de 10 operações).
   - **Coluna 2 (Ranking em Tempo Real)**: Header com contagem de participantes, tabela com `#`, `Trader`, `Rentabilidade`, `Ops`. Medalhas para Top 3 (ouro, prata, bronze), bandeiras internacionais (MX, CO, AR, BR, CL, PE, US), dados em `tabular-nums` com formatação positiva em verde.
   - **Coluna 3 (Prêmios por Posição)**: Header e escala oficial de 1º a 100º lugar com ícones de presente 🎁 e valores em reais (`R$ 1.000` a `R$ 10`).

---

## 3. Divisão em Subetapas Incrementais com Gates de Validação

```
┌─────────────────────────────────────────────────────────────┐
│ Subetapa 1: Refinamento de Fundo de Autenticação (Motion/UI)│ -> Testes Vitest (100% Verde)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Subetapa 2: Arquitetura e Modelagem do TournamentModal      │ -> Testes Vitest (100% Verde)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Subetapa 3: Visão de Lista de Torneios (Fiel à Imagem 1)    │ -> Testes Vitest (100% Verde)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Subetapa 4: Visão Detalhada de 3 Colunas (Fiel à Imagem 2)  │ -> Testes Vitest (100% Verde)
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Subetapa 5: Integração no SidebarDock & Certificação Final  │ -> Bateria Global Zero Regressão
└─────────────────────────────────────────────────────────────┘
```

**Regra Inviolável de Transição**: Nenhuma subetapa será iniciada sem que a anterior tenha seus testes unitários, testes de estresse e testes de caos executados com sucesso total.
