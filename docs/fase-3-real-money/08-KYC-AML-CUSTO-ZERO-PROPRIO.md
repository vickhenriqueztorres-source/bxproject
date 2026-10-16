# Fase 3 — KYC e AML Próprio com Custo R$ 0,00 (Sem Empresas Caras e 100% Dentro do Seu Painel Admin)

Você **não precisa pagar nenhuma empresa externa** (como Sumsub ou Veriff) e **não precisa enviar dados para lugar nenhum fora do seu servidor**.
Vamos construir o **Módulo KYC & AML Nativo da Binmax**, que roda **100% de graça dentro da sua própria VPS** e é controlado por você na mesma tela onde você já aprova os saques manuais!

---

## 1. Para Onde Vão os Documentos? (100% no Seu Servidor e no Seu Painel Admin)

- **Não vai para nenhuma empresa terceira.**
- Quando o cliente envia a foto do documento e a selfie:
  1. Os arquivos são comprimidos e salvos **criptografados (`AES-256`)** numa pasta blindada dentro da sua própria VPS (`/root/app/storage/kyc_vault`);
  2. Os dados ficam salvos na tabela `kyc_profiles` do seu PostgreSQL (guardando o histórico por 5 anos automaticamente);
  3. As fotos aparecem **exclusivamente para você dentro do seu Painel Admin (`/admin/`)** junto com o pedido de saque do cliente!

---

## 2. O Momento Certo de Pedir o KYC (Para Não Matar seus Depósitos!)

Se você pedir foto de RG e Selfie **antes** de o cliente fazer o primeiro depósito de `$10 USD` ou entrar num torneio de `$3 USD`, 80% das pessoas fecham o site por preguiça.

Por isso, faremos exatamente como a **IQ Option e a Quotex** fazem:

### Etapa 1 — No Cadastro / 1º Depósito (Leva 5 Segundos — Zero Atrito):
- Pede apenas: **Nome Completo + Número do CPF / DNI / Documento Local + Data de Nascimento (+18 anos)**.
- O nosso próprio código valida matematicamente na hora se o CPF/documento é verdadeiro (algoritmo de dígito verificador — custo zero) e se é maior de 18 anos.
- **Liberado na hora para depositar via PIX ou Binance e jogar Torneios!**

### Etapa 2 — No 1º Pedido de Saque ou Depósito via Cartão (KYC Completo com Selfie):
- Quando o cliente clica em **"Sacar"** pela primeira vez (ou se quiser usar Cartão de Crédito), a plataforma pede a verificação rápida da conta:
  1. **Foto do Documento (Frente e Verso)**: RG, CNH, DNI, Cédula ou Passaporte;
  2. **Selfie ao Vivo pela Câmera do Celular/PC**: Usando a câmera nativa do navegador (`getUserMedia`, sem permissão de galeria para evitar foto falsa baixada da internet).

---

## 3. Como Funciona o AML (Anti-Lavagem) Automático e Grátis no Código

O objetivo do AML é impedir que um criminoso deposite dinheiro roubado/sujo na sua plataforma e saque 5 minutos depois para outra conta como se você fosse uma casa de câmbio.

Nós resolvemos isso com **4 Regras Automáticas no Código (Custo R$ 0,00)**:

1. **Proibido Sacar para Terceiros (`Regra de Mesma Titularidade`)**:
   - O nome e o CPF/Documento da conta **têm que ser idênticos** ao titular da chave PIX ou do documento enviado no KYC.
   - Isso impede que alguém deposite com a conta de uma vítima e tente sacar para a conta do golpista.
2. **Proibido Depositar e Sacar Sem Operar (`Trava Anti-Ponte / Anti-Mixer`)**:
   - Como já definimos, ninguém consegue depositar e pedir saque sem girar pelo menos 100% do valor em operações no gráfico. Criminoso que quer lavar dinheiro foge na hora quando descobre que precisa arriscar o dinheiro operando no gráfico.
3. **Proibido Trocar de Canal de Pagamento (`Closed-Loop Rule`)**:
   - Quem depositou em **PIX** saca em **PIX** (no mesmo CPF).
   - Quem depositou em **Binance/USDT** saca em **USDT**.
   - Ninguém consegue depositar em cartão de crédito ou PIX de terceiro e pedir saque anônimo em cripto.
4. **Trava Automática para Movimentações Atípicas (`AML Alert`)**:
   - Se uma conta tentar depositar ou sacar valores altos fora do padrão (ex.: acima de `$500 USD` no início) ou tentar usar documentos repetidos em duas contas, o sistema trava o status como `AML_HOLD` e manda alerta no seu Telegram.

---

## 4. Como Você Opera Isso no Dia a Dia (Leva 10 Segundos no Admin)

Você só precisa olhar o KYC **de quem realmente pediu saque** (ou seja, você não perde tempo olhando documento de quem só depositou e perdeu operando!).

Quando chegar um pedido de saque manual no seu `/admin/`:
1. Na mesma tela do pedido de saque, você vê:
   - **Foto do Documento** | **Selfie na Câmera** | **Nome e CPF Cadastrados** | **Chave PIX / Carteira de Destino**.
2. Bateu o olho: a pessoa da selfie é a mesma do documento e o CPF é o mesmo da chave PIX?
3. Você clica em **[Aprovar KYC + Liberar Saque]**. Uma vez aprovado, aquele cliente já fica com selo **`KYC VERIFICADO`** para os próximos saques!
