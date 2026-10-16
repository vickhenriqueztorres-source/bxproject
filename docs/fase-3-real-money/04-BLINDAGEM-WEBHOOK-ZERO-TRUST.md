# Fase 3 — Blindagem Máxima de Webhook ("Zero-Trust" em 5 Camadas) para **Binance, PIX e Cartão**

Operando exclusivamente com **Binance (Binance Pay / USDT)**, **PIX** e **Cartão** (sem Mercado Pago), o servidor utiliza um **Adaptador Unificado Zero-Trust (`PaymentSecurityEngine`)** onde **nenhum centavo é creditado confiando apenas no webhook recebido**.

---

## Como Funciona o Escudo de 5 Camadas para **Binance, PIX e Cartão**

```text
[Webhook chega em POST /api/webhooks/:provider (binance | pix | card)]
   │
   ├─► CAMADA 1: Grava o Raw Payload + IP + Headers na tabela psp_webhook_logs antes de processar
   │
   ├─► CAMADA 2: Valida Assinatura Criptográfica (HMAC / RSA em tempo constante) + Anti-Replay (5 min)
   │             └── Falhou? -> Rejeita 401 + Alerta de Tentativa de Fraude no Telegram Admin
   │
   ├─► CAMADA 3: Pull Reverso na API Oficial (Binance API / API PIX / API Cartão)
   │             └── O servidor ignora o status do webhook e pergunta direto na API oficial se foi pago!
   │
   ├─► CAMADA 4: Casamento Estrito de 4 Campos contra o PostgreSQL
   │             └── Status PAGO + ID do pedido (external_id) + Moeda exata + Valor exato em centavos
   │
   └─► CAMADA 5: Trava Ácida no Banco (UNIQUE provider_tx_id + UPDATE ... WHERE status = 'PENDING')
                 └── Garante que mesmo 100 webhooks simultâneos creditem o saldo 1 ÚNICA VEZ!
```

---

## Como a Camada 2 (Assinatura) e a Camada 3 (Pull Reverso) Funcionam em Cada um dos 3 Métodos

### 1. BINANCE (Binance Pay & Depósito USDT TRC20/BEP20)
- **Camada 2 (Assinatura do Webhook)**:
  - Valida os headers `BinancePay-Timestamp`, `BinancePay-Nonce` e `BinancePay-Signature` (ou `HMAC-SHA512` da chave secreta) com janela anti-replay de 5 minutos.
- **Camada 3 (Verificação Reversa na API Oficial da Binance)**:
  - O seu servidor faz uma chamada direta autenticada com sua `BINANCE_API_KEY` e `BINANCE_API_SECRET`:
    - **Para Binance Pay**: `POST https://bpay.binanceapi.com/binancepay/openapi/v2/order/query` passando o `merchantTradeNo` (`deposit.id`) e confirma `"status": "PAID"` + valor exato em `USDT`.
    - **Para Depósito USDT via Rede (TRC20/BEP20)**: Consulta diretamente `GET https://api.binance.com/sapi/v1/capital/deposit/hisrec` (histórico oficial de depósitos da sua conta Binance) procurando o `txId` na blockchain com `status === 1 (credited)`!
  - **Resultado**: É impossível forjar um depósito de USDT/Binance porque o seu servidor confere diretamente dentro da sua conta na Binance antes de liberar o saldo!

---

### 2. PIX (Taxa 0% para o Cliente — Gateway PIX / API BACEN)
- **Camada 2 (Assinatura do Webhook PIX)**:
  - Valida assinatura `HMAC-SHA256` (ou certificado mTLS do Banco Central) enviada pelo gateway de PIX configurado (`PIX_WEBHOOK_SECRET`).
- **Camada 3 (Verificação Reversa na API Oficial do PIX)**:
  - Quando o webhook avisa que o PIX `txid` foi pago, o seu servidor faz um `GET` direto na API do provedor PIX (`GET /v2/cob/{txid}` ou `/v1/pix/{id}`) usando seu token privado de servidor.
  - Confirma que:
    1. O status oficial é `CONCLUIDA` / `PAID`;
    2. Existe um `endToEndId` (`E2E`) válido emitido pelo Banco Central;
    3. O valor pago em `BRL` bate centavo por centavo com o QR Code gerado.

---

### 3. CARTÃO DE CRÉDITO / DÉBITO (Com Taxa Embutida Repassada ao Cliente)
- **Camada 2 (Assinatura do Webhook de Cartão)**:
  - Valida o header `Stripe-Signature` / `X-Signature` via `HMAC-SHA256` (`crypto.timingSafeEqual`) + janela de 300 segundos.
- **Camada 3 (Verificação Reversa + Trava 3D Secure Anti-Chargeback)**:
  - O seu servidor consulta diretamente a API do processador de cartão (`GET /v1/payment_intents/{id}` ou equivalente) com a `CARD_SECRET_KEY`.
  - Confirma que:
    1. `status === 'succeeded'`;
    2. **Autenticação 3D Secure (`3DS`) aprovada** (obriga o titular a aprovar no app do banco, transferindo a responsabilidade de fraude/chargeback para o banco emissor);
    3. Calcula e desconta automaticamente a **taxa embutida do cartão** antes de creditar o valor líquido na carteira do cliente.

---

## Camada 4 e 5 — Idempotência Atômica Unificada no PostgreSQL (Para os 3 Métodos)

Independentemente de o pagamento vir da **Binance**, do **PIX** ou do **Cartão**, o crédito no banco passa pela mesma trava atômica:

```sql
UPDATE deposits
   SET status = 'COMPLETED',
       provider_tx_id = $1,
       paid_at = NOW()
 WHERE id = $2
   AND provider = $3
   AND status = 'PENDING'
RETURNING *;
```

- `provider_tx_id` (`prepayId` da Binance, `endToEndId` do PIX ou `chargeId` do Cartão) possui restrição **`UNIQUE`** no banco de dados.
- Um mesmo comprovante/transação jamais pode ser usado duas vezes, e 50 webhooks repetidos no mesmo segundo resultam em **apenas 1 único crédito** na carteira ou no torneio.
