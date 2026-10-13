# Subetapa 03: Módulo Financeiro — Modal & Telas de Depósito & Saque (Billetera / Cajero)

**Responsáveis:** `financial-correctness-reviewer`, `surgical-frontend-agent`, `compliance-risk-reviewer`, `qa-resilience-agent`  
**Imagens de Referência:**
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_21-4.png` (Modal de Depósito na Sala de Trading)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_22-5.png` (Depósito PIX Tela 2 - QR Code e Confirmação)
- `Imagem do ChatGPT 9 de out. de 2026, 20_50_22-6.png` (Modal / Tela de Saque - Retirar)
- `Imagem do ChatGPT 9 de out. de 2026, 20_52_33-8.png` (Modal Erro de Pagamento)

---

## 1. Objetivo Técnico
Desenvolver o módulo de transações financeiras (depósito e saque) disponível tanto como modal de 520px sobreposto na sala (sem tirar o trader do gráfico) quanto como páginas dedicadas (`/deposito` e `/retiro`), com fidelidade pixel a pixel, geração de QR code PIX real com expiração de 30 minutos, verificação de saldo via Blnk, restrição de KYC para saque e prevenção absoluta de double-spending e duplo clique.

---

## 2. Requisitos Visuais e de Fluxo

### 2.1 Depósito (`/deposito` ou modal de 520px)
- **Tela 1 — Seleção de Método & Valor:**
  - Título "Depositar", botão de fechar (X).
  - Subtítulo: "Elige un método de pago y realiza tu depósito para continuar operando."
  - 3 Métodos de pagamento em cartões lado a lado:
    1. **PIX:** Ícone oficial verde, badge "Mínimo $10", "Instantáneo".
    2. **Tarjeta:** Ícone de cartão bancário, badge "Mínimo $10", "Instantáneo".
    3. **Cripto (USDT TRC-20):** Ícone Tether oficial, badge "Mínimo $10", "Hasta 10 min".
  - Campo Monto com seletor numérico e botões chips de valor rápido:
    - Chips: `[$20]`, `[$50]`, `[$100]` (selecionado por padrão), `[$250]`, `[$500]`.
  - Resumo de liquidação: `Recibes $100.00 · Sin comisión`.
  - Card sutil de bônus: ícone de presente verde `#22C55E` e texto `"Bono de bienvenida +30% aplicado"` (com tooltip explicativo).
  - Botão verde largo "Continuar".
  - Rodapé: ícone de cadeado e `"Pagos procesados por proveedor seguro"`.
- **Tela 2 — Pagamento PIX:**
  - Stepper lateral/superior de 3 passos: `(1) Método de pago` -> `(2) Realiza el pago` -> `(3) Confirmación`.
  - QR Code grande de alta resolução gerado dinamicamente no padrão EMV do Banco Central.
  - Card "Esperando pago" com temporizador regressivo: `"Expira en 29:58"`.
  - Caixa de código "Código PIX (Copia y pega)" com botão de copiar em um clique e feedback de cópia.
  - Banner verde com animação de confirmação quando creditado: `"Pago confirmado - Tu depósito está siendo acreditado. Esto suele tardar unos segundos."`.
- **Tratamento de Falha:**
  - Exibição integrada do modal "No pudimos procesar tu pago" com botão "Intentar de nuevo" e "Cambiar método".

### 2.2 Saque / Retiro (`/retiro` ou modal de 520px)
- Título "Retirar", botão fechar (X).
- Card de saldo: `"Saldo disponible: $10,085.00"` (em verde e tipografia mono `Geist Mono`).
- Métodos de saque:
  1. Transferencia Bancaria
  2. PIX
  3. Criptomonedas
- Campo Monto com chips rápidos: `[$50]`, `[$100]`, `[$500]`, `[$1,000]`.
- Aviso com regra de negócio: `"Mínimo de retiro: $50.00"`.
- Campo: `"Clave PIX / Dirección de cartera"` com botão de colar.
- Aviso em cinza com ícone de informação: `"Primer retiro requiere verificación de identidad. Para tu seguridad, el primer retiro de la cuenta requiere completar la verificación de identidad (KYC)."`.
- Botão verde largo: `"Solicitar retiro"`.
- Card de histórico rápido: `"Último retiro"` com status amarelo `"En revisión"`, valor `$100.00`, data/hora e mensagem `"Tu solicitud está siendo revisada. Tiempo estimado: 5 – 30 minutos."`.

---

## 3. Invariantes Financeiras e Blindagem no Backend
- **I-01 (Saldo Centralizado no Blnk):** Nenhuma alteração de saldo ocorre via cálculo no frontend.
- **I-02 (Inteiro em Minor):** Todos os valores trafegam como centavos inteiros (`amount_minor`).
- **I-03 (Idempotência Estrita):** Toda solicitação de depósito ou saque envia `Idempotency-Key` único via UUIDv4.
- **I-04 (Anti-Duplo Disparo):** Desabilitação síncrona imediata (`disabled={isSubmitting}`) em todas as submissões.

---

## 4. Testes Obrigatórios da Subetapa 03
1. **Testes de Invariantes Financeiras (`src/trade/billetera-invariants.unit.test.tsx`):**
   - Garantir que nenhum float `0.85` ou divisão imperfeita seja feita na boleta ou depósito.
   - Idempotência de cliques repetidos (10 cliques em 50ms disparam exatamente 1 requisição).
2. **Testes do Fluxo PIX & Expiração:**
   - Contagem regressiva do timer de 30 minutos até 00:00 sem desvio acumulado de relógio.
   - Cópia do payload para o clipboard com sanitização de caracteres especiais.
3. **Testes de Validação de Saque:**
   - Bloqueio de saque quando o montante solicitado for superior ao saldo disponível.
   - Bloqueio quando o montante for inferior ao mínimo de $50.
