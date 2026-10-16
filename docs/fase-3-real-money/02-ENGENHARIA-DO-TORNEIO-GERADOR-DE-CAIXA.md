# Fase 3 — Engenharia do Torneio (Arena LATAM em USD) Blindada para Levantar Caixa do Zero

## 1. Operação 100% LATAM: Base em Dólar (`USD`) + Pagamento Local Direto no PSP

Como a operação roda em toda a **LATAM (México, Colômbia, Argentina, Chile, Peru, Brasil, etc.)**, toda a contabilidade, preços de inscrição e prêmios da Arena funcionam em **Dólar (`USD`, guardado em centavos `*_minor`)**, com conversão automática em tempo real para a moeda local do usuário no momento do checkout:

- **Inscrição (`Buy-in`)**: Ex.: **`$3.00 USD` ou `$5.00 USD`** (convertido automaticamente no checkout para `MXN` via SPEI/Mercado Pago, `COP` via PSE, `ARS` via Mercado Pago/CBU, `CLP`, `PEN`, `BRL` via PIX ou `USDT`).
- **Recompra (`Rebuy`)**: Ex.: **`$2.00 USD` ou `$3.00 USD`** (+`₮ 1.000` fichas).
- **`Add-on` Turbo**: Ex.: **`$5.00 USD`** (+`₮ 2.500` fichas).

### Regra #1 (`DIRECT_PAYMENT_ONLY`): Sempre exige um NOVO Pagamento (Não usa saldo da carteira)
- Quando o cliente clica em **"Inscrever-se (`$3.00 USD`)"** ou **"Fazer Rebuy (`$2.00 USD`)"**, o sistema **não desconta do saldo que ele já tem na carteira**.
- Abre o checkout rápido na moeda do país dele (Mercado Pago LATAM / PIX / SPEI / PSE / Cripto).
- Cada entrada e cada Rebuy injeta **dinheiro novo** direto na sua conta do PSP.

---

## 2. Vitrine Pública Normal (`1º, 2º e 3º em $ USD`) vs. Blindagem Oculta no Backend

### Como o Cliente Vê na Tela da Arena (Vitrine 100% Normal em `$ USD`):
Na tela do torneio, no card de premiação e no ranking final, **NÃO aparece a palavra "Bônus" em lugar nenhum**.
O cliente vê os 3 prêmios normais em Dólar definidos por você ao criar o torneio:
- **1º Lugar**: `$250.00 USD`
- **2º Lugar**: `$150.00 USD`
- **3º Lugar**: `$100.00 USD`
*(Ou qualquer valor em `$ USD` que você definir no Admin).*

Quando o torneio termina, o ganhador vê o **Saldo em `$ USD` no topo da sala subir exatamente com aquele valor** (ex.: `+$150.00 USD`), como saldo normal para operar.

---

### Como Funciona nos Bastidores para Você NUNCA se Lascar (100% Oculto na Arena):

Para que você nunca tenha que tirar dinheiro do bolso para pagar os 3 ganhadores no início, a proteção fica **oculta dentro do motor de carteira e saque (`backend`)**:

#### Camada Oculta 1 — Saldo Unificado na Tela, mas Travado por Rollover no Banco (`hidden_rollover_lock`)
- No topo da plataforma, o cliente vê um único saldo: **`$150.00 USD`**.
- Porém, na tabela interna do banco (`wallets`), esse valor que veio do torneio entra gravado como `tournament_credit_minor` atrelado a uma **Trava Interna de Giro (`rollover_target_minor = valor × 40`)**.
- O ganhador consegue **operar normalmente na sala** com esses `$150.00 USD`, mas:
  1. Se ele tentar solicitar saque antes de girar **40x o valor em trades** (ex.: `$150 × 40 = $6,000 USD` de volume operado), o sistema informa que a conta possui meta de volume operacional pendente antes da retirada;
  2. Quando ele perde nas operações da sala, o sistema queima esse saldo sem ter custado **`$0.00 USD`** do seu caixa real no PSP!

#### Camada Oculta 2 — Controle Silencioso de Liquidez / Pódio no Início (`House Liquidity Shield`)
No início, quando o seu caixa é `$0.00 USD` e um torneio ainda tem poucos pagantes reais:
- No seu **Painel Admin**, você define o **`Quorum Mínimo de Lucro da Casa`** daquele torneio (ex.: o torneio precisa arrecadar no mínimo `$600 USD` em inscrições/rebuys pagos para liberar premiação real).
- Além da **Trava de Rollover de 40x** em cima dos prêmios de 1º, 2º e 3º lugar:
  - No seu **Raio-X de Saques Manuais (exclusivo para você no Admin)**, quando qualquer cliente pede um saque, o painel mostra um selo interno só para você:
    - **`Origem do Saldo: Depósito Real ($20)`** vs. **`Origem do Saldo: Prêmio Torneio / Bônus ($150 — Rollover: 8% de 40x)`**.
  - Assim, **na tela do cliente os 3 lugares pagam o valor cheio normal em `$ USD`**, mas no seu caixa nenhum centavo sai sem que o torneio tenha dado lucro real e o cliente tenha cumprido todas as regras internas de giro!

---

## 3. Resumo da Arquitetura Final do Torneio LATAM

| Item | O que o Cliente Vê na Tela | O que Acontece no seu Caixa / Backend |
|---|---|---|
| **Moeda** | **`$ USD`** (com pagamento convertido na moeda do país LATAM dele) | Tudo contabilizado em centavos de dólar (`*_minor`) |
| **Pagamento de Entrada / Rebuy** | Checkout rápido para pagar a inscrição (`$3`, `$5`) ou Rebuy (`$2`, `$3`) | **Exige NOVO pagamento no PSP** (não usa saldo antigo da carteira) |
| **Prêmios de 1º, 2º e 3º Lugar** | **Valores normais em `$ USD`** (ex.: 1º `$250` / 2º `$150` / 3º `$100`) — **sem falar em bônus** | Soma no saldo visível de operação do cliente, mas fica marcado internamente com **Rollover de 40x** antes de permitir saque |
| **Pedido de Saque** | Solicita saque em `$ USD` (com taxa de saque da plataforma descontada) | Cai na sua **Fila Manual do Admin**, onde você vê quanto aquele cliente realmente depositou vs. quanto veio de torneio/bônus |
