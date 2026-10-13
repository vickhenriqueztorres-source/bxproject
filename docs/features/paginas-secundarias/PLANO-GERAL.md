# Plano Arquitetural Geral — Páginas Secundárias & Ecossistema BINMAX

**Projeto:** Plataforma de Índices Sintéticos (BINMAX)  
**Papel Responsável:** `tech-lead-orchestrator`  
**Referência Visual:** 18 Telas em `C:\Users\brend\Downloads\paginas secundarias`  
**Data:** Outubro de 2026  
**Status:** PRONTO PARA EXECUÇÃO CIRÚRGICA SUBETAPA POR SUBETAPA  

---

## 1. Convocação e Matriz de Especialistas (Pool de Agentes & Skills)

Para garantir máxima fidelidade visual, blindagem financeira inegociável, isolamento cirúrgico e conformidade estrita com `AGENTS.md` e `ORCHESTRATOR.md`, o pool de agentes e skills é formalmente alocado:

| Agente / Especialista | Papel e Escopo | Skills Ativadas | Limite de Permissão |
|---|---|---|---|
| **`tech-lead-orchestrator`** | Orquestração central, handoffs entre agentes, governança de gates e transição estrita de subetapas | `01-project-context`, `20-conduzir-etapa` | Leitura/Escrita em planos, relatórios e governança |
| **`broker-architect-agent`** | Desenho de arquitetura do ecossistema, fluxo de dados ponta a ponta e coerência com Blnk e Fastify | `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `08-database-foundation` | Desenho de arquitetura e validação sistêmica |
| **`backend-implementation-agent`** | Endpoints de apoio no Fastify (`/auth`, `/users/settings`, `/kyc`, `/tournaments`, `/analytics`), contratos e migrations | `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `08-database-foundation` | `write-code` estritamente em `services/**`, `db/migrations/**` |
| **`surgical-frontend-agent` (`cirurgiao`)** | Implementação cirúrgica dos componentes React, páginas secundárias, layouts arejados, live preview e carteira | `12-tokens-binmax`, `13-textos-es`, `15-chave-sala-nova`, `17-mudanca-cirurgica` | `write-code` estritamente em `apps/web/**` dentro do orçamento por passo |
| **`chart-trading-engineer`** | Mini-gráfico mudo e live chart do Vol 50 no Login/Landing, integração leve a 60 FPS | `03-synthetic-market-engine`, `11-chart-trading-tools` | `write-code` em `apps/web/src/chart/**` e feeds auxiliares |
| **`iq-fidelity-reviewer` (`fidelidade-iq`)** | Validação geométrica e de fidelidade visual 1:1 contra as 18 imagens de referência (tolerância < 10px) | `14-teste-de-sobreposicao`, `11-chart-trading-tools` | `read-only` estrito com poder de veto visual |
| **`binmax-brand-agent` (`marca-binmax`)** | Auditoria de tokens de cor, tipografia Archivo + Geist Mono, cantos 6px e microcopy em espanhol neutro | `12-tokens-binmax`, `13-textos-es` | `read-only` estrito (tokens e copy) |
| **`compliance-risk-reviewer` (`compliance-risco`)** | Validação de integridade de saldo, aviso regulatório de risco no rodapé, anti-duplo clique e KYC | `01-project-context`, `02-financial-invariants`, `18-zonas-sensiveis` | `read-only` estrito com poder de veto de risco |
| **`qa-resilience-agent`** | Criação e execução de testes de estresse, concorrência, caos, resiliência de rede e segurança | `05-resilience-patterns`, `06-testing-quality`, `19-testes-de-regressao-visual` | `write-tests-only` em `apps/web/src/**/*.unit.test.{ts,tsx}` |
| **`regression-guardian-agent` (`guardiao-regressao`)** | Auditoria de diffs contra `docs/zonas-sensiveis.txt`, garantia de zero regressão na sala existente | `06-testing-quality`, `18-zonas-sensiveis`, `19-testes-de-regressao-visual` | `read-only` estrito com veto de regressão |

---

## 2. Princípios de Design & Identidade Visual BINMAX

Em conformidade estrita com as imagens de referência fornecidas:

- **Filosofia de Layout:**
  - A sala de trading (`/traderoom` ou `/operar`) é **escura e densa**, focada na alta frequência de ticks, ferramentas vetoriais e execução em 60s.
  - As páginas de entrada e conta (`/login`, `/registro`, `/recuperar`, `/ajustes`, `/historial`, etc.) são **escuras e arejadas**, com amplo respiro (negative space), tipografia límpida e foco contextual por cartão.
- **Paleta Cromática Oficial:**
  - Fundo principal: `#0B1220` (Noche Profunda)
  - Superfícies e Cartões: `#111A2B` (Panel Azul Escuro)
  - Bordas e divisores: `#1F2A3A` (Borda de Contraste Suave)
  - Texto principal: `#E6EDF5` (Blanco Puro suave)
  - Texto secundário / labels: `#8A96A8` (Cinza neutro legível)
  - Verde BINMAX: `#22C55E` (Estritamente para ações primárias, ganhos, saldo e SUBE)
  - Vermelho BINMAX: `#EF4444` (Estritamente para erros, alertas, perdas e BAJA)
  - Azul Acento / Indicador de aba ativa: `#38BDF8` / `#2563EB`
  - Amarelo Status (Pendente): `#EAB308`
- **Tipografia:**
  - Interface geral, botões e labels: `Archivo`, sans-serif.
  - Valores monetários, cotações, timers regressivos e relógios: `Geist Mono`, `monospace`, com `font-variant-numeric: tabular-nums`.
- **Formas e Detalhes:**
  - `border-radius: 6px` em todos os botões, inputs, cards e modais.
  - Transições suaves (150ms-200ms ease-out).
  - Microcopy 100% em **Espanhol Neutro** oficial para o mercado hispânico.

---

## 3. Arquitetura de Roteamento SPA e Preservação Cirúrgica

Para não quebrar a aplicação existente e garantir navegação fluida:
1. **Roteamento Híbrido SPA no Front:**
   - Implementação de um `Router` leve e robusto sem dependências externas pesadas (ou baseado no histórico do navegador `window.history.pushState` / `popstate` e detecção de `pathname`), perfeitamente compatível com Vite e a infraestrutura existente.
2. **Tabela de Rotas Oficiais:**
   - `/` : Landing pública para visitantes ou redirecionamento para operar se logado
   - `/operar` (e `/traderoom`) : A sala de trading BINMAX completa existente (100% intacta)
   - `/login` : Tela de login dividida com live chart do Vol 50
   - `/registro` : Tela de cadastro rápido em 1 etapa com conta de prática de $10.000
   - `/recuperar` : Fluxo de recuperação de senha em 3 passos
   - `/deposito` : Página ou modal de depósito (PIX, Tarjeta, USDT TRC-20)
   - `/retiro` : Página ou modal de saque com verificação de saldo e KYC
   - `/verificacion` : Tela de verificação de identidade em 3 passos com upload
   - `/ajustes` : Painel de configurações (Perfil, Segurança, Operação, Notificações, Idioma)
   - `/historial` : Extrato bancário de operações com filtros e exportação CSV
   - `/torneos` : Grade de torneios e ranking ao vivo
   - `/analisis` : Métricas analíticas do trader (taxa de acerto, win streaks, gráficos diários)
   - `/tutoriales` : Central de vídeos tutoriais e player em modal
   - `/promociones` : Cartões transparentes de bônus, cashback e eventos
   - `/callback` : Callback OIDC Keycloak já existente
   - `*` : Página 404 estilizada com link "Ir a operar"

---

## 4. Decomposição do Plano em 8 Subetapas Sequenciais

A regra inviolável de execução estipula:
> **"so vai pra proxima.. ate a anterior esta 100% validada e funciona e segura"**

```text
[Subetapa 01] Roteamento SPA, Layout Shell Arejado, Design Tokens e Estados Globais
     │ (100% Validada com Vitest + Testes de Rota + Regressão Zero)
     ▼
[Subetapa 02] Autenticação Real & Telas de Acesso (Login, Registro e Recuperação de Senha)
     │ (100% Validada com Brute-Force Rate-Limiting + OIDC + Guest Mode)
     ▼
[Subetapa 03] Módulo Financeiro — Modal & Telas de Depósito & Saque (Billetera / Cajero)
     │ (100% Validada com Invariantes I-01 a I-06 + QR Code PIX + Anti-Duplo Clique)
     ▼
[Subetapa 04] Verificação de Identidade (KYC) & Perfil / Ajustes de Segurança
     │ (100% Validada com Upload Seguro + 2FA Mock/Real + Sessões Ativas + BOLA Check)
     ▼
[Subetapa 05] Histórico Completo de Operações & Portfólio das Operações Abertas
     │ (100% Validada com Exportação CSV RFC-4180 + Timers ao Vivo + Toast de Ganho)
     ▼
[Subetapa 06] Módulos de Engajamento: Torneos, Análisis, Tutoriales & Promociones
     │ (100% Validada com Métricas Matemáticas de Win Rate + Rankings + Modal Player)
     ▼
[Subetapa 07] Landing Pública Oficial (`/`) com Live Preview da Sala e Gráfico Vol 50
     │ (100% Validada com Responsividade Mobile/Desktop + SEO + Acessibilidade A11y)
     ▼
[Subetapa 08] Bateria Integrada de Testes de Estresse, Caos, Segurança e Certificação Final
     │ (Gate Final de Aprovação com 100% de Testes Verdes e Zero Regressão)
     ▼
[Pronto para Produção]
```

---

## 5. Critérios de Aceite Globais

1. **Zero Quebra:** Todos os 456 testes pré-existentes devem continuar passando a cada subetapa.
2. **Isolamento de Zonas Sensíveis:** Nenhuma linha de cálculo financeiro ou liquidação pessismista de contratos no backend é alterada sem justificativa de invariante.
3. **Fidelidade Visual:** Todas as cores, tipografias, alinhamentos e espaçamentos respeitam as 18 imagens de referência.
4. **Resiliência a Falhas:** Falhas de rede ou backend exibem estados amigáveis de reconexão ou erro claro, sem telas brancas ou crashes de renderização.
5. **Espanhol Neutro:** 100% dos textos das telas novas seguem o vocabulário e tom das imagens de referência da BINMAX.
