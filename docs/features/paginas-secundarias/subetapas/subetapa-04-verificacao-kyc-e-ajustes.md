# Subetapa 04: Verificação de Identidade (KYC) & Perfil / Ajustes de Segurança

**Responsáveis:** `security-reviewer`, `surgical-frontend-agent`, `backend-implementation-agent`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_23-7.png` (Verificação de Conta `/verificacion`)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_24-8.png` (Perfil e Ajustes `/ajustes`)

---

## 1. Objetivo Técnico
Entregar a página de verificação de identidade regulatória (`/verificacion`) com 3 passos auditáveis, upload interativo com drag-and-drop e status em tempo real, além do painel de ajustes (`/ajustes`) com navegação interna por cartões modulares e configurações de segurança (troca de senha, 2FA, sessões ativas com revogação e preferências operacionais).

---

## 2. Requisitos Visuais e Funcionais

### 2.1 Verificação de Conta (`/verificacion`)
- **Cabeçalho:** "Verificación de cuenta - Completa la verificación para desbloquear todas las funciones de BINMAX y operar sin límites."
- **Coluna Esquerda (Passos de Verificação):**
  - **Passo 1: Email**
    - Status verde `"Aprobado"` com timestamp.
    - Texto explicativo: "Confirma tu dirección de correo electrónico para asegurar tu cuenta."
  - **Passo 2: Identidad**
    - Status amarelo `"Pendiente"`.
    - Texto: "Sube un documento de identificación oficial (frente y reverso)."
    - Área de dropzone interativa com ícone de upload na nuvem: `"Arrastra tus archivos aquí o haz clic para seleccionar"`.
    - Formatos aceitos: JPG, PNG ou PDF (máx. 10 MB por arquivo).
    - Card lateral de documentos válidos: DNI / Cédula de identidad, Pasaporte, Licencia de conducir.
  - **Passo 3: Dirección**
    - Status azul `"En revisión"` com data/hora de envio.
    - Texto: "Sube un comprobante de domicilio reciente (no mayor a 3 meses)."
    - Dropzone de arquivo para comprovante.
    - Card de comprovantes válidos: Factura de servicios (luz, agua, gas), Estado de cuenta bancario, Recibo de internet o telefonía, Documento gubernamental.
- **Coluna Direita (Progresso & Ajuda):**
  - Card "Tu progreso": 1 de 3 completados, barra de progresso em 35%. Lista com Email (Aprobado), Identidad (Pendiente), Dirección (En revisión).
  - Card explicativo "¿Por qué verificar tu cuenta?": 4 checks verdes (Operar sin límites, Realizar retiros, Acceder a todos los torneos, Participar en promociones exclusivas).
  - Card de exemplo "Ejemplo de documento rechazado" com status vermelho `"Rechazado"` e motivo: "El documento no es legible. Por favor, sube una imagen más nítida donde se vean todos los datos."

### 2.2 Perfil e Ajustes (`/ajustes`)
- Menu lateral interno com abas:
  - **Perfil:** Nome completo, Correo electrónico, País (dropdown com bandeiras), Teléfono (com código de discagem internacional), botão verde "Guardar".
  - **Seguridad:**
    - Troca de senha: Nova senha com indicador de força, Confirmar senha, botão "Guardar".
    - 2FA (Verificación en dos pasos): Toggle interativo "Autenticador de aplicaciones (Google Authenticator, Authy, etc.)" com badge verde "2FA activado - Tu cuenta está protegida".
    - Sesiones activas: Lista de dispositivos conectados (Windows Chrome - Sesión actual verde; iPhone Safari; Windows Edge) com botões vermelhos "Cerrar" para revogação imediata.
  - **Operación:** Monto padrão ($100), Expiración padrão (01:00 min), Switch "Confirmación de un clic", Switch "Sonido de resultado", botão "Guardar".
  - **Notificaciones:** Switches para Email de depósito, Email de saque, Email de torneo, botão "Guardar".
  - **Idioma y zona horaria:** Dropdown de Idioma (Español / Português), Dropdown de Zona horaria (ex: UTC-6 Ciudad de México / UTC-3 Buenos Aires / UTC), Formato de data, botão "Guardar".

---

## 3. Integração com Backend & Banco de Dados
- Conexão direta com as tabelas `kyc_profiles`, `countries` e endpoints existentes em `services/api/src/routes/kyc.ts`.
- Endpoints de preferências em `services/api/src/routes/users.ts`:
  - `GET /api/v1/user/settings`
  - `PUT /api/v1/user/settings`
  - `POST /api/v1/user/sessions/terminate`
- Proteção estrita contra BOLA/IDOR: todas as consultas filtram rigorosamente por `WHERE user_id = :authenticated_user_id`.

---

## 4. Testes Obrigatórios da Subetapa 04
1. **Testes de Dropzone & Validação de Arquivo:**
   - Rejeição de tipos não autorizados (ex: `.exe`, `.bat`).
   - Rejeição de arquivos maiores que 10MB.
2. **Testes de Segurança e BOLA/IDOR:**
   - Garantir que um usuário não consegue consultar nem alterar sessões ou preferências de terceiros.
3. **Testes de Estados de KYC:**
   - Transição correta entre PENDING -> IN_REVIEW -> APPROVED / REJECTED com exibição do motivo.
