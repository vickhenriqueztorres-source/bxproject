# Fase 3 — Arquitetura de Bônus (Custo Zero para o Caixa) & Máquina de Marketing FTD

## 1. O Segredo das Corretoras: Como Dar Bônus Agressivo com Caixa R$ 0 sem Nunca Tomar Prejuízo

Se você simplesmente somar o bônus ao saldo real sem regras matemáticas, dois problemas acontecem:
1. O cliente dá um "all-in" alto, ganha na sorte e saca um dinheiro que nunca foi depositado no seu Mercado Pago.
2. **Golpe das Duas Contas (Arbitragem de Bônus)**: Um fraudador cria a Conta A (deposita R$ 100 + ganha R$ 100 de bônus = R$ 200) e a Conta B (deposita R$ 100 + ganha R$ 100 de bônus = R$ 200). No mesmo segundo, entra com R$ 200 em `SUBE` na Conta A e R$ 200 em `BAJA` na Conta B. Uma conta zera e a outra vai para R$ 370. Ele deposita R$ 200 no total e saca R$ 370 sem risco.

Para que o bônus tenha **Custo Real Zero para o seu caixa** e funcione como um **retentor de liquidez**, implementamos as **4 Travas Matemáticas de Bônus**:

---

### Trava 1 — Separação no Ledger (`real_cash` vs. `bonus_credit`) e Queima "Real Primeiro" (`Waterfall`)
No topo do site, o cliente vê **"Saldo Operacional: R$ 200,00"** (o que dá a sensação psicológica de banca dobrada). Porém, no banco de dados e no Blnk Ledger, existem dois potes separados:
- `real_cash`: R$ 100,00 (o PIX que entrou de verdade)
- `bonus_credit`: R$ 100,00 (crédito promocional não-sacável)

**Como funciona a cada clique (`POST /contracts`):**
- O sistema **sempre consome primeiro o `real_cash`**.
- Se o cliente perder os primeiros R$ 100, o `real_cash` dele zera (**os R$ 100 no seu Mercado Pago já viraram 100% lucro da casa!**) e ele continua operando com os R$ 100 de `bonus_credit`.
- Enquanto ele está operando com o bônus, ele só consegue transformar aquilo em saque se bater o **Rollover Completo**.

---

### Trava 2 — Rollover de 40x sobre o Valor do Bônus (`Turnover Lock`)
Para que o `bonus_credit` (e os lucros feitos com ele) virem saldo sacável (`real_cash`), o cliente precisa movimentar um volume total de trades igual a **40x o valor do bônus**:
$$\text{Volume Exigido} = \text{Valor do Bônus} \times 40$$

- **Exemplo prático**:
  - Cliente depositou R$ 100 no PIX e ganhou R$ 100 de bônus.
  - Meta de volume para destravar o bônus: $\text{R\$ 100} \times 40 = \text{R\$ 4.000,00}$ em operações liquidadas (empates `DRAW` não contam para o volume).
- **Por que 40x protege matematicamente o seu caixa R$ 0?**
  - Com payout de 85%, a margem matemática da casa por giro é de ~7,5% (para um operador com 50% de acerto).
  - Em 40 giros ($40 \times 7,5\% = 300\%$), a perda estatística esperada durante o giro é **3 vezes maior que o próprio bônus**.
  - Na prática: **mais de 95% dos usuários não completam os 40x**, o que mantém o cliente operando por muito mais tempo e retém o depósito original no caixa da plataforma.

---

### Trava 3 — Limite de Aposta por Clique no Rollover (Anti-Arbitragem de 2 Contas)
Para impedir o golpe de abrir 2 contas e dar "all-in" de R$ 200 em `SUBE` numa e `BAJA` noutra:
- Quando o cliente tem bônus ativo, **cada operação conta no máximo 5% a 10% do valor do bônus para a barra de rollover** (ou o stake máximo com bônus fica travado em 10% da banca).
- Isso obriga o cliente a fazer pelo menos **20 a 40 operações separadas** para girar o bônus. Em 40 operações independentes, a sorte de 1 clique desaparece e a matemática da casa sempre vence.

---

### Trava 4 — Regra de Saque com Bônus Ativo (Duas Modalidades)
Se o cliente depositou R$ 100 + ganhou R$ 100 de bônus e tentar pedir saque **antes** de completar os 40x de giro:
1. **Enquanto o Rollover < 100%**: O valor do bônus (`bonus_credit`) **jamais pode ser sacado**.
2. Se o cliente ainda tiver saldo `real_cash` e quiser sacar imediatamente desistindo do bônus:
   - O sistema exibe um aviso claro: *"Ao solicitar saque antes de concluir 100% da meta do bônus, o valor do bônus (R$ 100) e os ganhos proporcionais ao bônus serão cancelados, aplicando-se a taxa padrão de saque."*
   - O sistema queima o `bonus_credit` instantaneamente no ledger antes de enviar o pedido para a sua fila manual.

---

## 2. Como Isso Traz Vantagem Financeira Direta para a Plataforma no Início

Para quem está começando com **Caixa R$ 0**, o sistema de bônus estruturado acima resolve **3 problemas críticos de caixa** no primeiro mês:

1. **Dobra ou Triplica o Ticket Médio do Primeiro Depósito (Mais Caixa Vivo no Mercado Pago)**:
   - Sem bônus escalonado, o usuário brasileiro/latino deposita o mínimo (R$ 20 ou R$ 30) só para "testar".
   - Quando você coloca na tela do PIX que **R$ 30 dá 20% de bônus**, mas **R$ 100 dá 100% de bônus (R$ 200 para operar)**, o cliente deposita R$ 100.
   - Esses R$ 100 entram **em dinheiro vivo** na sua conta do Mercado Pago no Dia 1, engordando a sua **Reserva Livre da Casa** 3x mais rápido.
2. **Trava os Saques nos Primeiros Dias (Retenção de Liquidez)**:
   - O cliente que aceita o bônus entra focado em "bater a barrinha de meta do bônus".
   - Em vez de depositar R$ 100, ganhar R$ 30 no primeiro trade e já pedir saque (o que daria trabalho manual e drenaria liquidez), ele continua operando para tentar bater o rollover de 40x.
   - Isso dá **fôlego de caixa** para a plataforma acumular depósitos antes de ter volume de saques.
3. **Zero Custo de Aquisição (CAC Zero em Dinheiro Vivo)**:
   - Você não precisa tirar R$ 1 do bolso para "pagar" o bônus ao cliente: o bônus é apenas um número contábil na sub-carteira `bonus_credit` que exige 40x de giro para virar dinheiro real.

---

## 3. Estratégia de Marketing de Conversão (FTD) usando o Bônus

Aplicando os gatilhos de resposta direta (Metodologia Beto — Urgência, Especificidade e Contraste Demo vs. Real):

### Mecânica 1 — A "Escada de Poder" no Modal de Depósito PIX
Dentro do `BinmaxDepositModal`, em vez de botões secos de valor, o cliente vê 3 cartões de alavancagem com **PIX Taxa Zero**:
- **Start (R$ 50)**: `+30% de Bônus` → Opera com **R$ 65,00**
- **Pro Trader (R$ 100 — Mais Escolhido 🔥)**: `+100% de Bônus Dobrado` → Opera com **R$ 200,00** + *Acesso à Arena*
- **Elite Sniper (R$ 250)**: `+120% de Bônus` → Opera com **R$ 550,00** + *Prioridade na Fila de Saque*

### Mecânica 2 — Gatilho Automático "Vitória na Demo → Dobro no PIX"
- O motor do front-end detecta quando o usuário na conta **DEMO** acerta **2 ou 3 operações seguidas**.
- Naquele exato pico de dopamina, aparece uma barra discreta e cirúrgica (sem cara de cassino, estética de precisão Binmax):
  > **"Leitura precisa: 3 acertos seguidos (+85%). Na conta Demo esse resultado é apenas simulação. Ative sua Conta Real via PIX (0% de taxa) nos próximos 15 min e dobre sua margem operacional com +100% de Bônus."**

### Mecânica 3 — "Primeira Entrada Blindada" (Seguro em Bônus)
- Para converter o usuário que tem medo de depositar pela primeira vez:
  > **"Deposite a partir de R$ 100 via PIX. Se a sua 1ª operação real (até R$ 20) fechar no negativo, devolvemos 100% do valor dela em Crédito de Bônus na hora."**
- **Por que é genial para o seu caixa R$ 0?**
  - Se ele ganhar a 1ª operação, ele fica empolgado e continua operando.
  - Se ele perder a 1ª operação, os R$ 20 reais dele já ficaram para a casa, e você devolve R$ 20 em `bonus_credit` (com rollover de 40x). Custo para o seu bolso: **zero**.

### Mecânica 4 — Barra de Progresso de Rollover Visível na Carteira
- Dentro do drawer da carteira real, o cliente vê:
  - `Saldo Real (Sacável)`
  - `Margem de Bônus Ativa`
  - `Progresso de Desbloqueio do Bônus: R$ 640 / R$ 4.000 (16%)`
- Essa barra visual mantém o trader engajado na plataforma tentando chegar aos 100%, aumentando drasticamente o LTV (tempo de vida e volume operado por cliente).
