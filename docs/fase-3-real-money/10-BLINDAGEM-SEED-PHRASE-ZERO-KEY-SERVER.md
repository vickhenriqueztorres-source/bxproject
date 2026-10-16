# Fase 3 — Blindagem de Seed Phrase e Private Key (`Arquitetura Watch-Only / Zero-Private-Key no Servidor`)

## 1. O Erro Fatal que Faz Plataformas Perderem Todos os USDT

Plataformas amadoras colocam a `PRIVATE_KEY` ou a `SEED_PHRASE` (as 12/24 palavras) dentro do arquivo `.env` da VPS para o servidor fazer movimentações sozinho.
Se um hacker invade a VPS e lê o `.env`, ele importa a Seed Phrase em 5 segundos e limpa 100% dos USDT sem volta.

---

## 2. A Nossa Solução Definitiva: **ZERO Private Key no Servidor (`Watch-Only Architecture`)**

Na **Binmax**, a sua **Seed Phrase e a sua Private Key NUNCA entram no servidor** (nem no código, nem no `.env`, nem no banco de dados).

**Como o servidor recebe e confirma USDT automaticamente sem ter a Private Key?**
- Na blockchain (Rede Tron `TRC20` ou BNB Chain `BEP20`), para **receber** pagamentos e **verificar** que o dinheiro caiu, o servidor só precisa do **Endereço Público (`Public Address`)** ou da **Chave Pública Estendida (`xpub` — Watch-Only)**!
- Com o endereço público / `xpub` (ou API `Read-Only` da Binance):
  - ✅ O servidor mostra o QR Code da carteira para o cliente pagar;
  - ✅ O servidor consulta a blockchain (`TronGrid` / `BscScan` / `Binance Read-Only`) e confirma em segundos que os USDT entraram, liberando o saldo do cliente ou as fichas do torneio no automático;
  - 🔒 **É matematicamente impossível gastar ou sacar 1 centavo usando endereço público ou `xpub`!**

---

## 3. Como Fica a Estrutura das Suas Carteiras na Prática (Custo Zero)

```text
[Servidor VPS da Binmax]
   └── Guarda APENAS: Endereço Público (Watch-Only) + API Key Read-Only
   └── Seed Phrase / Private Key no servidor = ZERO (Não existe!)
          │
          ▼
[1. Carteira Quente de Recebimento (Hot Wallet — Saldo Baixo)]
   ├── Recebe os depósitos automáticos do dia
   ├── Você usa pelo seu celular isolado para pagar os saques manuais aprovados
   └── Quando acumula (ex: passou de $300 USD), você transfere o excesso para o Cofre Frio!
          │
          ▼
[2. Cofre Frio / Multisig 2-de-3 (Cold Storage — Onde fica o Lucro da Casa)]
   ├── Carteira 100% Offline (Hardware Wallet ou Multisig 2-de-3 na TronLink/Safe)
   ├── Exige 2 assinaturas de dispositivos diferentes seus para mover qualquer centavo
   └── Seed Phrase anotada apenas em papel/metal físico (nunca em bloco de notas, foto de celular ou nuvem)
```

---

## 4. As 4 Regras de Ouro que Implementamos para Blindar seus USDT

1. **Zero Chave Privada na VPS (`Watch-Only`)**:
   - O servidor monitora os depósitos apenas pelo endereço público da carteira e pela API de leitura. Se um hacker invadir a VPS inteira, ele só encontra o endereço público (que não serve para roubar nada).
2. **Trava Anti-Seed no Código (`Boot Security Guard`)**:
   - O próprio código do servidor verifica no arranque se existe alguma variável `PRIVATE_KEY`, `SEED_PHRASE` ou `MNEMONIC` no ambiente e bloqueia caso alguém tente colocar chave privada no servidor no futuro.
3. **Separação `Hot Wallet` (Giro Diário) × `Cold Wallet` (Cofre de Lucro)**:
   - Na carteira do dia a dia (`Hot Wallet`), você mantém apenas o valor pequeno para pagar os saques manuais do dia.
   - Todo o lucro acumulado fica na sua **`Cold Wallet` (Carteira Fria offline)**.
4. **Multisig `2-de-3` para o Cofre Principal (Grátis na rede Tron / BSC via Safe)**:
   - Quando o caixa crescer, você ativa o **Multisig 2-de-3** na carteira principal: para tirar qualquer valor do cofre, é obrigatório assinar com **2 dispositivos separados seus** (ex.: Celular 1 + Carteira Offline 2). Mesmo que alguém roube 1 aparelho seu, não consegue tirar 1 dólar!
