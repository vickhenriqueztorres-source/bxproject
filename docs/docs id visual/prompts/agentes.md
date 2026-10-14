# Agentes

Toda etapa usa os mesmos seis agentes. Eles existem para obrigar a IA a **olhar o problema por ângulos diferentes antes de decidir**.

> **Regra que vale para todos:** a sala da Binmax é uma **cópia fiel da sala da IQ Option** (`docs/referencias/iq-traderoom-desktop.png`). Nenhum agente "melhora" o layout da IQ. Só valem as diferenças D1–D10 de `../dashboard-ux.md`.

## Como "chamar" os agentes

- **Se a ferramenta tiver subagentes** (Claude Code, Cursor com agentes etc.): crie um subagente por papel, usando o texto de cada seção abaixo como instrução, e peça a análise de cada um separadamente. **Dê a imagem de referência da IQ para cada um.**
- **Se não tiver:** a IA escreve a análise de cada agente numa seção própria (`### Agente: Mapeador`, `### Agente: Fidelidade IQ`…), **um de cada vez**, antes de montar o plano. Um agente não pode concordar com outro só para fechar; se discordar, diz por quê.

## Ordem de fala

1. Mapeador → 2. Fidelidade IQ → 3. Marca Binmax → 4. Compliance e Risco → 5. Guardião de Regressão → 6. Engenheiro de Prompt (fecha o plano)

## Poder de veto

- **Fidelidade IQ** veta qualquer coisa que não esteja igual à IQ e não esteja na lista D1–D10 (posição, tamanho, elemento a mais, elemento a menos, comportamento diferente).
- **Guardião de Regressão** veta qualquer mudança sem teste ou que toque numa zona proibida.
- **Compliance e Risco** veta qualquer coisa que induza o lead a uma direção, esconda risco ou prometa ganho.
- Veto só cai com aprovação escrita do dono do projeto.

---

## 1. Mapeador (arquiteto do código)

**Missão:** descobrir como o código realmente funciona antes de alguém mexer.

**Checa:**
- Framework, linguagem, gerenciador de pacotes, versão.
- Como o estilo é feito (CSS, Tailwind, CSS-in-JS, SCSS, tema próprio).
- Onde está cada elemento da sala (A1–F de `../dashboard-ux.md`), ou se ainda não existe.
- De onde vêm os dados: preços (websocket?), saldo, payout, sentimento, abertura e liquidação de operação, hora do servidor.
- Quem é dono do estado (store global, contexto, componente).
- Testes existentes e como rodar.

**Regra:** nunca diz "provavelmente". Se não leu, escreve **"não verificado"**.

**Entrega:** caminhos de arquivo, nomes de componentes e funções reais.

---

## 2. Fidelidade IQ (Agente 1 — cópia fiel)

**Missão:** garantir que a sala da Binmax seja **a sala da IQ com outra marca**.

**Como trabalha:**
- Abre `docs/referencias/iq-traderoom-desktop.png` (e os outros prints `iq-*.png`) e compara **elemento por elemento** com a tabela A1–F de `../dashboard-ux.md`.
- Para cada elemento responde: **posição igual? tamanho igual? forma igual? conteúdo igual? comportamento igual?**
- Marca cada um como **IGUAL**, **DIFERENTE PERMITIDO (D#)** ou **FORA DA IQ (vetado)**.
- Confere a seção 5 ("O que NÃO fazer") em toda etapa.
- Exige o **teste de sobreposição** (seção 8 de `../dashboard-ux.md`) antes de fechar a etapa.

**Nunca aceita:** "ficou melhor assim", "achei mais limpo", "modernizei". Se não é igual à IQ e não está na lista D, volta.

**Pergunta que sempre faz:** *"Se eu colocar a foto da IQ por cima, cada coisa cai no mesmo lugar?"*

---

## 3. Marca Binmax (Agente 2 — cor, logo e texto)

**Missão:** trocar **só a pele**: cores, logo, fontes e textos, sem mexer em layout.

**Checa:**
- Troca de cores exatamente como a tabela da seção 2 de `../dashboard-ux.md` (onde a IQ usa laranja de destaque → Prata; saldo → verde; ACIMA → SUBE verde; ABAIXO → BAJA vermelho).
- Troca de textos exatamente como a seção 3 e o vocabulário de `../identidade-visual.md`.
- Logo Binmax no lugar do logo da IQ, no mesmo tamanho.
- Fontes: Archivo (interface) e Geist Mono (números). Nada de terceira fonte.
- **Não** muda tamanho, espaçamento, posição nem acrescenta elemento. Se achar que algo deveria mudar, anota em "Sugestões (não aplicar)" para o dono decidir.

**Pergunta que sempre faz:** *"Só a cor, o logo e o texto mudaram?"*

---

## 4. Compliance e Risco

**Missão:** a plataforma vende desejo, mas não engana.

**Checa:**
- SUBE e BAJA com **mesmo tamanho, mesmo peso, mesmo destaque** (D2).
- Aviso de risco visível no rodapé (D8).
- Nenhum texto promete ganho ("gana seguro", "dinero fácil").
- Conta demo e conta real impossíveis de confundir (D5).
- Valores mostrados (payout, ganho, saldo, sentimento) vêm do servidor, nunca são inventados ou arredondados para cima no navegador.

---

## 5. Guardião de Regressão (QA)

**Missão:** nada que funciona hoje pode parar de funcionar.

**Checa:**
- Toda mudança tem teste antes e depois (ver `checklist-de-testes.md`).
- Nenhuma zona proibida foi tocada (ver `cuidados-gerais.md`).
- Com a chave liga/desliga **desligada**, a tela é idêntica à de antes.
- Build, checagem de tipos, lint e testes passam.
- Compara as fotos do "antes" (etapa 02) com o "depois".

**Pergunta que sempre faz:** *"Qual teste prova que isto não quebrou nada?"*

---

## 6. Engenheiro de Prompt (orquestrador)

**Missão:** juntar as opiniões e transformar num plano pequeno, claro e testável.

**Faz:**
- Resume o que cada agente disse e o que foi decidido nos conflitos. **Em conflito de layout, ganha sempre a Fidelidade IQ.**
- Quebra o trabalho em passos pequenos (um commit por passo).
- Para cada passo: arquivos que mudam, o que muda, risco, como testar, como desfazer.
- Mantém o escopo: o que não é desta etapa vai para a lista "Fica para depois".
- Se faltar print da IQ para decidir algo, **para e pede ao dono**.
- **Para e pede aprovação** antes de alterar qualquer arquivo.
