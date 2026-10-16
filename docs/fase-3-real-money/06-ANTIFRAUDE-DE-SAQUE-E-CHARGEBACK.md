# Fase 3 — Motor Antifraude de Saque e Blindagem Anti-Chargeback (`Withdrawal Risk Engine`)

## 1. Como Funciona o Golpe de Saque (e Como Cortamos Pela Raiz)

```text
[O Golpe Clássico]
Golpista usa cartão roubado -> Deposita $100 -> Pede saque imediato em PIX/USDT -> Recebe -> 15 dias depois vem o Chargeback do cartão = Prejuízo Real
```

Na sua operação (**Binance, PIX e Cartão + Saque Manual pelo Admin**), cortamos esse golpe com **6 Travas Automáticas** que rodam antes de você pagar qualquer centavo:

---

## 2. As 6 Travas do Motor Antifraude (`scripts/lib/withdrawal-antifraud.mjs`)

### Trava 1 — Quarentena Obrigatória para Depósito via Cartão (`Card Anti-Chargeback Hold`)
O motor separa a origem do depósito:
- **Origem PIX ou Binance/USDT**:
  - **Risco de Chargeback = ZERO** (PIX e Cripto são irreversíveis na liquidação). Cumprido o giro obrigatório, o saque já pode ir para a sua fila normal.
- **Origem Cartão de Crédito**:
  1. **Delay de Segurança Anti-Chargeback (`7 a 14 dias` configurável no Admin)**: Quem depositou via cartão **não consegue** sacar via PIX ou USDT no mesmo dia! O saldo oriundo de cartão fica em janela de maturação (`card_hold_until`) e exige **KYC aprovado (Documento + Selfie)**.
  2. **Exigência de 3D Secure (`3DS`)**: No checkout de cartão, só aceitamos cartões autenticados com `3DS` (confirmação no app do banco do titular).

---

### Trava 2 — Bloqueio de "Saque Imediato Sem Operar" (`Rollover Gate`)
Se o golpista deposita `$100` e tenta clicar em **"Sacar"** 2 minutos depois sem operar:
- O backend **recusa na hora**!
- **Regra dura no código**:
  - Depósito sem bônus: exige no mínimo **`1.0x` (100%) de volume operado** em contratos fechados na sala.
  - Saldo com Bônus ou Prêmio de Torneio: exige **`40x` de volume operado**.
- Ninguém consegue usar a plataforma como "ponte" para depositar num método e sacar no outro sem girar na sala.

---

### Trava 3 — Delay de Saque de 24h (`Cooling-Off`) + Limite Diário por Conta
1. **Delay Programado (`24h`)**:
   - Todo saque solicitado entra com janela de processamento de **até 24h**. Isso impede saques relâmpago de madrugada e dá tempo para qualquer alerta antifraude do provedor de pagamento chegar antes de você transferir o dinheiro.
2. **Teto Diário de Saque (`Daily Cap`)**:
   - No início (com caixa zero), cada cliente tem um **limite máximo de saque por dia** (ex.: máx. `$100 USD/dia` no nível inicial, ajustável no seu Admin) e **apenas 1 pedido pendente por vez**.

---

### Trava 4 — Cruzamento de Device, IP, País e Carteira (`Multi-Account & Mule Detector`)
O servidor grava o `device_fingerprint`, `ip_address`, `country` e a `chave PIX / carteira USDT` de todos os usuários e faz 4 cruzamentos automáticos no momento do pedido de saque:
1. **Mesmo Device ou IP em outra conta**: Detecta se o usuário abriu 2 contas para apostar `SUBE` numa e `BAJA` noutra (+50 pontos de risco);
2. **País do IP diferente do País do Cadastro/Cartão**: Detecta uso de VPN/Proxy ou cartão roubado de outro país (+40 pontos de risco);
3. **Chave PIX ou Carteira USDT já usada por outro usuário**: Detecta "conta laranja" tentando concentrar saques de várias contas (+80 pontos de risco — bloqueio automático);
4. **Titularidade divergente**: No PIX, o CPF/nome do titular deve bater com o cadastro.

---

### Trava 5 — Auditoria Estatística dos Trades (`Winrate & Timing Anomaly`)
O antifraude analisa como o cliente ganhou aquele saldo antes de pedir o saque:
- Se o cliente teve **Winrate > 78%** em mais de 15 operações seguidas ou padrão anormal de execução → marca alerta de **Anomalia de Trading** para você inspecionar os contratos dele no Admin.

---

### Trava 6 — O Semáforo de Decisão no seu Painel Admin (`Verde / Amarelo / Vermelho`)
Como todos os saques são pagos manualmente por você, o sistema calcula o **`Risk Score (0 a 100)`** de cada pedido e organiza sua tela do Admin com diagnóstico pronto:

| Classificação | Score | Quando Acontece | Ação no Sistema |
|---|---|---|---|
| 🟢 **VERDE (Seguro)** | `0 – 25` | Depositou via **PIX ou Binance/USDT**, cumpriu 100% do rollover, mesmo device/IP, sem bônus pendente, dentro do limite diário | **Liberado para você pagar com tranquilidade** |
| 🟡 **AMARELO (Atenção)** | `26 – 59` | Primeiro saque da conta, ou lucro muito alto sobre um depósito pequeno (ex.: depositou `$10` e quer sacar `$120`) | **Exige conferência visual rápida do histórico no Admin** |
| 🔴 **VERMELHO (Risco Alto / Fraude)** | `60 – 100` | Depósito via **Cartão** recente, tentativa de saque sem giro, múltiplas contas no mesmo IP/Device ou carteira USDT repetida em outra conta | **Travado automaticamente + Alerta no seu Telegram** |

---

## 3. Fluxo Completo Blindado do Saque

```text
[Cliente pede Saque]
   │
   ├─► 1. Cumpriu Rollover (1x depósito puro / 40x bônus ou torneio)?
   │      └── NÃO -> Bloqueia na hora na tela do cliente (mostra barra de volume restante)
   │
   ├─► 2. Tem depósito de Cartão dentro da janela de Hold (7–14 dias) sem KYC?
   │      └── SIM -> Bloqueia na hora ("Saldo em período de compensação de segurança do cartão")
   │
   ├─► 3. Está dentro do Limite Diário e sem outro saque pendente?
   │      └── SIM -> Congela o saldo na carteira (available -> pending_withdrawal) e desconta a Taxa de Saque
   │
   ├─► 4. Motor Antifraude calcula o Score (Valor + Método + Device + IP + País + Winrate)
   │      ├── 🟢 Score Baixo  -> Vai para a Fila "Prontos para Pagamento" no seu Admin
   │      └── 🔴 Score Alto   -> Vai para a Fila "Retidos por Segurança / Revisão Estrita" + Alerta Telegram
   │
   └─► 5. Após o Delay de Segurança (ex.: 24h), você confere no Admin e paga (ou estorna/bloqueia)
```
