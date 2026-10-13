# Subetapa 02: Autenticação Integrada & Telas de Acesso (Login, Registro e Recuperação)

**Responsáveis:** `backend-implementation-agent`, `surgical-frontend-agent`, `security-reviewer`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_20-1.png` (Login `/login` e estados de erro, loading e bloqueio)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_20-2.png` (Cadastro `/registro` e card de prática)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_21-3.png` (Recuperar Senha `/recuperar` em 3 passos)

---

## 1. Objetivo Técnico
Entregar uma experiência de autenticação de classe institucional conectada ao banco de dados e backend Fastify, com fluxo fluido de login, registro em 1 única etapa com onboarding imediato de $10.000 demo na sala, recuperação de senha em 3 passos com temporizador, e live chart mudo do Vol 50 na coluna esquerda comprovando mercado em tempo real antes mesmo do login.

---

## 2. Requisitos Visuais e Funcionais

### 2.1 Login (`/login`)
- **Divisão Desktop 55% / 45% (Mobile: apenas formulário 100%):**
  - **Lado Esquerdo (55%):**
    - Logo BINMAX OPTION no topo superior esquerdo.
    - Mini-gráfico de velas vivo e mudo de Vol 50 (`Vol50LiveMiniChart.tsx`) exibindo candles OHLC reais e preço em tempo real sem botões de boleta.
    - Manchete: "Opera en 60 segundos. Práctica gratis con $10.000."
    - 3 pilares em cinza com ícones: "Pagos en 24h", "Soporte en español", "Cuenta de práctica ilimitada".
  - **Lado Direito (45%):**
    - Card escuro `#111A2B` com bordas `#1F2A3A`.
    - Título "Iniciar sesión", subtítulo "Accede a tu cuenta BINMAX y continúa operando."
    - Campo Correo electrónico com ícone de envelope.
    - Campo Contraseña com ícone de cadeado e toggle de visualização (olho mostrar/ocultar).
    - Link "¿Olvidaste tu contraseña?" com navegação para `/recuperar`.
    - Botão verde largo `#22C55E` "Entrar".
    - Divisor e link "¿No tienes cuenta? Crear cuenta" para `/registro`.
    - Rodapé com seletor de idioma (ES / PT) e links de Termos e Privacidade.
  - **Tratamento de Estados:**
    - Erro de autenticação: borda vermelha `#EF4444` no input e mensagem "Email o contraseña incorrectos".
    - Estado de envio: botão com spinner e texto "Entrando...".
    - Bloqueio por força bruta: após 5 tentativas incorretas, card muda para "Cuenta bloqueada" com ícone de cadeado e contador "Intenta nuevamente en 15 minutos".

### 2.2 Cadastro (`/registro`)
- Mesmo layout e estilo do login.
- **Formulário em 1 única etapa:**
  - Nombre completo.
  - Email institucional/pessoal.
  - Contraseña com indicador de força (mínimo 6 caracteres).
  - Seletor de País com detecção automática (IP ou padrão "España / México / Brasil / Colombia / Argentina / Chile / Perú") e bandeiras SVG.
  - Checkbox "Acepto los términos y condiciones de BINMAX".
  - Checkbox "Tengo 18 años o más".
  - Botão verde "Crear cuenta de práctica ->".
  - Card informativo com ícone de presente: "Entrarás directamente a la sala de trading con $10.000 en modo práctica y un recorrido guiado para tu primera vez."
- Ao submeter, cria a conta no backend, provisiona a carteira demo de $10.000, gera a sessão e redireciona imediatamente para a sala de trading (`/operar`).

### 2.3 Recuperação de Senha (`/recuperar`)
- Cartão centralizado de 420px com fluxo reativo de 3 passos:
  - **Passo 1 (Solicitação):** Título "Recuperar acceso", campo de email, botão verde "Enviar enlace", link "Volver al inicio de sesión".
  - **Passo 2 (Confirmação):** Ícone de check circular verde, "Revisa tu correo", "Te hemos enviado un enlace para restablecer tu contraseña a: [email]", caixa com relógio "El enlace vence en 15 minutos", links "Enviar de nuevo" e "Volver al inicio de sesión".
  - **Passo 3 (Redefinição):** Ícone de cadeado, "Nueva contraseña", campos "Nueva contraseña" (mín. 8 caracteres) e "Confirmar contraseña", botão verde "Guardar".

---

## 3. Integração com Backend & Banco de Dados
- **Endpoints de Autenticação Fastify (`services/api/src/routes/auth.ts`):**
  - `POST /api/v1/auth/login`: Validação com rate limiting baseado em Redis (5 tentativas / 15 min por IP/email).
  - `POST /api/v1/auth/register`: Registro com hash Argon2/Bcrypt, inserção no Postgres, criação de carteira demo no Blnk/mock e emissão de JWT.
  - `POST /api/v1/auth/forgot-password` e `POST /api/v1/auth/reset-password`: Gestão de token efêmero com TTL de 15 minutos.
- Suporte duplo transparente: Autenticação via Keycloak/OIDC existente E autenticação direta via API Fastify.

---

## 4. Testes de Estresse, Segurança e Caos
1. **Segurança (S-01 a S-06):**
   - Sanitização estrita contra XSS e SQL Injection nos formulários.
   - Headers anti-CSRF e proteção contra visualização de senhas no DOM por ferramentas de inspeção indevidas.
2. **Estresse & Força Bruta:**
   - Teste de 10 tentativas simultâneas de login: validação de ativação do bloqueio na 6ª requisição (HTTP 429).
3. **Resiliência a Caos:**
   - Simulação de queda da API Fastify: feedback elegante para o usuário com fallback para modo demonstração offline.
