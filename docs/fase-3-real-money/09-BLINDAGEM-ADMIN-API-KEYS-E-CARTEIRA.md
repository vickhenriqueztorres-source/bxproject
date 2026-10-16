# Fase 3 — Blindagem Militar do Painel Admin, API Keys e Carteira (`Admin & Secrets Fortress`)

## 1. A Grande Vantagem do Seu Modelo (Saque Manual = API Key Sem Permissão de Saque!)

Na maioria das plataformas que são hackeadas, o hacker rouba a `API Key` do servidor e usa a própria chave para disparar saques automáticos para a carteira dele.

Como na sua operação **os saques são 100% manuais**, nós aplicamos o **Princípio do Menor Privilégio Absoluto**:
1. **A API Key da Binance e do PIX no servidor NUNCA têm permissão de saque (`Enable Withdrawals = OFF`)!**
   - A chave que fica na VPS só tem permissão para **Criar Cobrança (QR Code)** e **Consultar Depósitos (`Read-Only`)**.
2. **Trava de IP Fixo na Chave (`IP Whitelist = 169.58.159.77`)**:
   - No painel da Binance e do gateway PIX, configuramos a API Key para aceitar conexões **apenas do IP exato da sua VPS**.
- **Resultado**: Mesmo que alguém no mundo roubasse a sua API Key, **é impossível tirar R$ 0,01 ou $0.01 da sua conta**, porque a chave não tem poder de saque e só responde ao IP do seu servidor!

---

## 2. Blindagem do Painel Admin (`/admin/`) em 4 Camadas (Custo R$ 0,00)

Para garantir que ninguém consiga invadir o `/admin/` para alterar saldo, criar torneio falso ou mexer em configurações:

### Camada 1 — 2FA Obrigatório no Admin (`Google Authenticator / Authy — TOTP`)
- O login do `/admin/` exige:
  1. E-mail/Usuário Admin + Senha forte (`bcrypt/argon2`);
  2. **Código 2FA de 6 dígitos que muda a cada 30 segundos no seu celular (`TOTP RFC 6238`)**.
- Mesmo que alguém descubra sua senha, sem o seu celular físico na mão é impossível entrar no Admin.

### Camada 2 — Confirmação Extra (`Step-Up 2FA`) para Ações Financeiras Críticas
Dentro do Admin, qualquer clique que mexa em dinheiro ou regra do sistema exige digitar o código de 6 dígitos do 2FA:
- Marcar saque como pago ou estornar saque;
- Ajustar saldo / aplicar `reversal` de conciliação;
- Alterar taxas, limites de stake ou regras de premiação de torneio.

### Camada 3 — Bloqueio Automático Contra Força Bruta + Alerta no Telegram
- Se alguém errar a senha ou o código 2FA do Admin **3 vezes seguidas**:
  - O servidor bloqueia aquele IP por **24 horas** automaticamente;
  - Envia na mesma hora um alerta no seu **Telegram Privado**: *"🚨 Tentativa de acesso bloqueada no Admin vinda do IP X.X.X.X"*.

### Camada 4 — Log Imutável de Auditoria (`admin_audit_logs`)
- Toda ação feita no `/admin/` fica gravada para sempre na tabela `admin_audit_logs` com:
  - `admin_user`, `action`, `target_user_id`, `old_value`, `new_value`, `ip_address`, `user_agent` e `created_at`.
- A role da aplicação no PostgreSQL só tem permissão de `INSERT` e `SELECT` nessa tabela (proibido `DELETE` ou `UPDATE`), garantindo que nenhum rastro possa ser apagado.

---

## 3. Higiene de Segredos e Proteção do Caixa (`Cold Storage`)

1. **Zero Chaves no Código / GitHub**:
   - Todas as chaves (`BINANCE_API_KEY`, `PIX_TOKEN`, `WEBHOOK_SECRET`, `JWT_SECRET`, `ADMIN_TOTP_SECRET`) ficam exclusivamente em variáveis de ambiente no arquivo `/root/app/.env` da VPS com permissão `chmod 600` (somente o root da VPS lê).
   - Rotação simples de chaves sem derrubar o sistema.
2. **Isolamento de Caixa (`Hot Wallet` vs. `Cold Wallet`)**:
   - Os pagamentos entram na conta operacional;
   - Diariamente, ao olhar o **Lucro Livre da Casa** no seu Painel Admin, você transfere o seu lucro acumulado para uma **Carteira Fria (`Cold Wallet` / Hardware Wallet ou conta bancária pessoal isolada)** que não tem nenhuma ligação com o sistema.

---

## 4. Resumo Geral dos 7 Pilares de Blindagem da Fase 3

| # | Risco | Como a Binmax Blinda |
|---|---|---|
| **1** | **Carteira / Seed Phrase** | API Keys **sem permissão de saque** (`Read/Receive Only`) + IP travado na VPS + Lucro movido para Cold Wallet |
| **2** | **Webhook Falso** | **Escudo Zero-Trust de 5 Camadas**: `Raw Log` + `HMAC timingSafeEqual` + **Pull Reverso na API Oficial da Binance/PIX/Cartão** |
| **3** | **Idempotência (Duplo Crédito/Saque)** | Tabela `idempotency_keys` antes de processar + `SELECT ... FOR UPDATE` + Índice Único de 1 saque pendente + `reference` única no Blnk |
| **4** | **Antifraude de Saque e Chargeback** | **Saque 100% Manual** + Hold de 7–14 dias em Cartão + Rollover obrigatório (1x real / 40x bônus e torneio) + Semáforo `Verde/Amarelo/Vermelho` (Device/IP/País) |
| **5** | **Reconciliação Diária** | Robô de 15 min (recupera webhooks perdidos) + Batimento diário linha por linha (`Provedor ↔ Postgres ↔ Blnk`) + Trava automática se divergir `$0.01` |
| **6** | **KYC / AML (Custo R$ 0)** | **KYC Nativo Próprio** na hora do saque (Documento + Selfie ao vivo salvos criptografados na sua VPS) + Regra de mesma titularidade e mesmo canal |
| **7** | **Acesso Admin / API Keys** | **2FA TOTP obrigatório** no Admin + Step-Up 2FA em ações críticas + Variáveis de ambiente `chmod 600` + Audit Log imutável + Alertas no Telegram |
