# Plano Geral e Robusto — Refinamento Institucional do Portafólio de Operações Binmax

## 1. Contexto Executivo & Análise de Referência Visual

O objetivo desta feature é refinar cirurgicamente a gaveta lateral (**Portafolio Total**) e os **Cards de Operações Abertas e Fechadas**, transformando o visual atual em uma interface de trading institucional de alta fidelidade baseada na imagem de referência fornecida pelo usuário (`media_1791582778148_5c35f99d.png`).

A implementação segue rigorosamente a arquitetura orquestrada do projeto, garantindo:
- **Zero quebras**: Nenhuma alteração nas invariantes financeiras, cálculo de payout ou engine de saldo (Blnk).
- **Alterações cirúrgicas**: Intervenção restrita a `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`, `apps/web/src/components/sidebar/SidebarDock.tsx` e testes unitários dedicados.
- **Fidelidade visual absoluta**: Elementos alinhados pixel a pixel com a imagem do usuário e tokens da Binmax (Noche `#151922`, Card `#171F2B`, Archivo, Geist Mono, Verde `#22C47A`, Vermelho `#F2545B`).
- **Funcionalidade 100% dinâmica**: Barra de progresso viva de tempo transcorrido, contagem regressiva `mm:ss` em tempo real, P&L dinâmico com base no tick atual, e alternância fluida entre abas "Abiertas" e "Cerradas".

---

## 2. Decomposição Pixel a Pixel da Referência Visual (`media_1791582778148_5c35f99d.png`)

```
┌────────────────────────────────────────────────────────┐
│ Portafolio total                                     ✕ │  <- Header limpo, sem emojis, tipografia Archivo 14px
├────────────────────────────────────────────────────────┤
│   Abiertas 2                Cerradas                   │  <- Abas estilo underline (branco ativo / cinza inativo)
│ ══════════════                                         │
├────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ (EU)(US)  EUR/USD  [↑ ARRIBA]             +$85.00  │ │  <- Topo do Card: Bandeiras duplas, símbolo, badge sólido, P&L
│ │                                                    │ │
│ │ Invertido     [==========           ]       00:32  │ │  <- Barra de progresso verde + cronômetro mm:ss
│ │ $100                                Expira 02:21:00│ │  <- Valor da aposta + carimbo de expiração HH:mm:ss
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │ (NZ)(JP)  NZD/JPY  [↓ ABAJO]              -$50.00  │ │  <- Card perdedor: badge vermelho sólido, P&L negativo
│ │                                                    │ │
│ │ Invertido     [========             ]       01:10  │ │  <- Barra de progresso neutra/prata + cronômetro mm:ss
│ │ $50                                                │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Detalhamento dos Componentes do Card:
1. **Container do Card**:
   - Fundo: `#171F2B` (superfície elevada sobre `#151922`).
   - Borda: `1px solid rgba(255, 255, 255, 0.07)` com `border-radius: 8px`.
   - Padding: `12px 14px`.
2. **Identificação do Ativo**:
   - Ícone: Par de bandeiras circulares sobrepostas em SVG puro (`AssetFlagBadge`).
   - Símbolo: Texto limpo (ex: `EUR/USD`, `NZD/JPY`), fonte Archivo, 13px, bold `#FFFFFF`.
3. **Badge de Direção**:
   - `↑ ARRIBA`: Fundo verde vibrante `#22C47A`, texto branco, seta para cima, raio 4px, padding `2px 7px`, bold 700.
   - `↓ ABAJO`: Fundo vermelho vibrante `#F2545B` / `#E53935`, texto branco, seta para baixo, raio 4px, padding `2px 7px`, bold 700.
   - *Compatibilidade*: Preserva marcadores ocultos para compatibilidade com testes legados (`SUBE`/`BAJA`).
4. **P&L Dinâmico**:
   - Vencedor: `+$85.00` em verde institucional `#22C47A`, fonte Geist Mono bold 14px.
   - Perdedor: `-$50.00` em vermelho institucional `#F2545B`, fonte Geist Mono bold 14px.
5. **Seção de Investimento & Progresso**:
   - Rótulo `Invertido`: Muted `#8A92A1`, 10.5px.
   - Montante: `$100` / `$50`: Fonte Geist Mono bold 13px `#FFFFFF`.
   - Barra de Progresso: Trilho de 3px a 4px de altura, `rgba(255, 255, 255, 0.1)`, preenchimento verde para operações vencedoras e neutro/branco para perdedoras.
   - Cronômetro regressivo: `00:32` / `01:10`, Geist Mono bold 12.5px `#FFFFFF`.
   - Carimbo de expiração: `Expira 02:21:00`, muted `#8A92A1`, 10px.

---

## 3. Matriz de Agentes & Skills Especializadas

| Agente | Responsabilidade Nesta Feature | Skills Ativadas |
| :--- | :--- | :--- |
| **`tech-lead-orchestrator`** | Coordenação geral, governança de gates, validação dos relatórios | `01-project-context`, `20-conduzir-etapa` |
| **`broker-architect-agent`** | Especificação dos contratos de tempo, P&L e invariantes | `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine` |
| **`surgical-frontend-agent`** | Implementação cirúrgica dos componentes React, CSS e hooks de timer | `12-tokens-binmax`, `15-chave-sala-nova`, `17-mudanca-cirurgica` |
| **`qa-resilience-agent`** | Criação de testes unitários, estresse (100+ cards), caos e testes de regressão | `06-testing-quality`, `05-resilience-patterns` |
| **`compliance-risk-reviewer`** | Validação de integridade financeira e microcopy em espanhol LATAM neutro | `02-financial-invariants`, `13-textos-es`, `18-zonas-sensiveis` |
| **`regression-guardian-agent`** | Execução e garantia de 100% verde em todos os 507 testes existentes | `06-testing-quality`, `19-testes-de-regressao-visual` |

---

## 4. Estrutura das 6 Subetapas Gated

1. **Subetapa 01**: Header Institucional & Abas "Abiertas N" / "Cerradas"
   - Ajuste do cabeçalho da gaveta em `SidebarDock.tsx` (sem emojis no modo Binmax).
   - Abas com indicador sublinhado ativo (white underline) e contador dinâmico.
2. **Subetapa 02**: Arquitetura dos Cards de Operações Abertas
   - Novo layout dos cards: bandeiras duplas, símbolo formatado, badges `↑ ARRIBA` e `↓ ABAJO`.
   - Projeção de P&L em tempo real baseada no strike e preço atual do tick.
3. **Subetapa 03**: Barra de Progresso Viva & Cronômetro Regressivo em Tempo Real
   - Hook de tempo preciso (`useContractCountdown`) para atualização a cada segundo.
   - Cálculo de porcentagem decorrida `(now - created_at) / (expires_at - created_at)`.
   - Renderização da barra e do texto `Expira HH:mm:ss`.
4. **Subetapa 04**: Aba de Operações Fechadas ("Cerradas") & Estado Vazio Sóbrio
   - Aplicação da mesma linguagem visual refinada aos contratos finalizados (`WIN`/`LOSS`).
   - Estado vazio elegante quando não há operações ativas ou fechadas.
5. **Subetapa 05**: Bateria de Testes de Estresse, Caos e Segurança
   - Teste de estresse com 100+ contratos simultâneos sem perda de performance (<8ms render).
   - Testes de caos: relógio do cliente dessincronizado, tick nulo/inválido, contratos expirados sem settlement.
   - Testes de segurança: integridade de valores monetários e ausência de mutação de saldo no client.
6. **Subetapa 06**: Certificação Integrada, Build de Produção e Deploy VPS
   - Execução da suíte completa de 507+ testes com 100% de aprovação.
   - Build do frontend (`@broker/web`).
   - Deploy na VPS (`169.58.159.77`), reload Nginx e reinício PM2.
