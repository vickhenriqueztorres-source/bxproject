Como vai funcionar o prd do TCC
DA FASE 1 
TEMA
 
 Plataforma de Índices Sintéticos
## MVP (Fase 1) — América Latina

---

## 1. Visão do Produto que sera apresentado.

Plataforma web que permite usuários na América Latina operarem contratos de
subida/descida (UP/DOWN) sobre índices sintéticos e ativos OTC.

---

## 2. Problema que queremos resolver ao apresentar 

Usuários da América Latina interessados em trading não têm acesso fácil a uma
plataforma que:
- Funcione em seu idioma e moeda local.
- Ofereça experiência de trading em tempo real sem risco financeiro.
- Seja simples, rápida e confiável.

Plataformas existentes são complexas, em inglês, ou exigem depósito imediato.

---

## 3. Objetivos

### Objetivo primário
Validar que usuários LatAm conseguem operar contratos UP/DOWN em modo 
com experiência fluida, em seu idioma e moeda.

### Objetivos secundários
- Validar arquitetura técnica (tick engine, ledger, tempo real).
- Preparar base para expansão multi-país (Fase 2).
- Preparar base para dinheiro real (Fase 3).

---

## 4. Métricas de Sucesso

| Métrica | Meta Fase 1 |
|---|---|
| Usuários cadastrados (beta) | 100 |
| Usuários ativos semanais | 30 |
| Contratos abertos por usuário/semana | 5 |
| Latência p95 de abertura de contrato | < 200ms |
| Taxa de erro 5xx | < 0.1% |
| Divergência de saldo (reconciliação) | 0 |
| Uptime | 99% |

Usuarios sao avaliadores e 109 professores 

---

## 5. Personas

### Persona 1 — Iniciante
- Idade: 18-35
- País: Brasil/México/Colômbia
- Nunca operou antes
- Quer aprender sem risco
- Usa celular

### Persona 2 — Trader casual
- Já operou em outra plataforma
- Quer testar estratégia em modo demo
- Valoriza velocidade e gráfico

### Persona 3 — Admin
- Dono da plataforma
- Precisa ver usuários, contratos, ledger, alertas
- Precisa pausar índice ou bloquear usuário

---

## 6. Escopo — Fase 1

Vamos apresentar isso no dia da apresentação e isso precisa esta funcionando.

### Incluído
- Login e carteira demo (Keycloak + Blnk).
- 1 índice sintético.
- Tick engine com CSPRNG.
- Contrato UP/DOWN com expiração fixa (60s).
- Ledger simples (Blnk).
- Histórico e gráfico (Lightweight Charts).
- Painel admin básico.
- Monitoramento básico (Prometheus + Grafana + Loki).

### Fora do escopo (Fase 1)
- Múltiplos países.
- Múltiplos idiomas.
- Múltiplas moedas.
- OTC com feed real.
- Dinheiro real.
- KYC.
- PSP.
- Depósito/saque.

---

## 7. User Stories

### US-01 — Cadastro
Como visitante, quero me cadastrar com email e senha para acessar a plataforma.

**Aceite:**
- Cadastro via Keycloak.
- Confirmação de email.
- Redirecionamento para dashboard após cadastro.

### US-02 — Login
Como usuário, quero fazer login para acessar minha carteira demo.

**Aceite:**
- Login via Keycloak (OIDC).
- MFA opcional (TOTP).
- Sessão persistente com refresh token.

### US-03 — Ver saldo demo
Como usuário, quero ver meu saldo demo em USD para saber quanto tenho.

**Aceite:**
- Saldo inicial: $`10.000.
- Saldo exibido no header.
- Atualização em tempo real após cada contrato.

### US-04 — Ver gráfico
Como usuário, quero ver o gráfico do índice sintético em tempo real.

**Aceite:**
- Gráfico de candles (Lightweight Charts).
- Atualização a cada tick (1/segundo).
- Histórico de 100 candles ao carregar.

### US-05 — Abrir contrato UP/DOWN
Como usuário, quero apostar se o preço vai subir ou descer em 60 segundos.

**Aceite:**
- Escolher direção (UP/DOWN).
- Escolher stake (mín `$1, máx $100).
- Preço de entrada registrado.
- Expiração em 60s.
- Idempotência por requisição.

### US-06 — Ver resultado
Como usuário, quero ver se ganhei ou perdi após expiração.

**Aceite:**
- WIN: stake + 85% de lucro creditado.
- LOSS: stake debitado.
- DRAW: stake devolvido.
- Notificação visual do resultado.

### US-07 — Ver histórico
Como usuário, quero ver meus contratos anteriores.

**Aceite:**
- Lista com direção, stake, resultado, timestamp.
- Filtro por resultado (WIN/LOSS/DRAW).

### US-08 — Admin: ver usuários
Como admin, quero ver lista de usuários cadastrados.

**Aceite:**
- Tabela com email, data de cadastro, saldo.
- Busca por email.

### US-09 — Admin: ver contratos
Como admin, quero ver todos os contratos abertos/fechados.

**Aceite:**
- Tabela com usuário, direção, stake, resultado, timestamp.
- Filtro por status.

### US-10 — Admin: pausar índice
Como admin, quero pausar o índice sintético em caso de problema.

**Aceite:**
- Botão pausar/retomar.
- Novos contratos bloqueados quando pausado.
- Contratos abertos continuam até expirar.

---

## 8. Requisitos Funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Cadastro/login via Keycloak | Alta |
| RF-02 | Carteira demo com saldo inicial $10.000 | Alta |
| RF-03 | Ti

