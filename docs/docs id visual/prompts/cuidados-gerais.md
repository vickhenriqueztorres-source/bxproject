# Cuidados gerais — como não quebrar o sistema

A IA deve ler este arquivo em **toda** etapa e seguir cada regra.

---

## 1. Zonas proibidas (não alterar sem autorização explícita)

Mudanças visuais **não** podem tocar em:

- Regras de negócio: cálculo de payout, liquidação, preço de entrada e saída, horário de vencimento.
- Chamadas à API e websocket: endereços, formato das mensagens, ordem dos campos.
- Autenticação, sessão, cadastro, verificação de identidade (KYC).
- Depósito, saque, gateways de pagamento, bônus.
- Banco de dados, migrações, filas, tarefas agendadas.
- Variáveis de ambiente, segredos, configuração de deploy e CI.
- Rotas e URLs públicas (links de afiliados e campanhas dependem delas).
- Rastreamento e analytics (pixels, eventos, IDs de elementos usados em funis).

Se uma mudança visual **precisar** encostar numa dessas zonas, a IA para, explica por quê e espera aprovação.

---

## 2. Regras de trabalho

1. **Sempre numa branch nova.** Nunca na `main`/`master`/`production`.
2. **Um commit por passo**, com mensagem clara (`feat(sala): ticket com atalhos de monto`).
3. **Ler antes de editar.** Abrir o arquivo inteiro e os arquivos que o usam.
4. **Mudar o mínimo.** Não reformatar arquivos inteiros, não renomear, não "aproveitar para organizar".
5. **Não apagar arquivos.** Se algo deixa de ser usado, listar em "Fica para depois".
6. **Não adicionar nem atualizar bibliotecas** sem justificar e pedir aprovação. Nunca atualizar várias de uma vez.
7. **Não trocar a biblioteca de gráfico.** Estilizar a que já existe.
8. **Reaproveitar componentes existentes.** Criar novo só se não existir equivalente.
9. **Nada de valores fixos falsos** (saldo, payout, preço) no código final. Tudo vem dos dados reais.
10. **Nunca colocar segredo, chave ou token** em arquivo, log ou mensagem.
11. **Sem `console.log` esquecido** no final da etapa.

---

## 3. Chave liga/desliga (criada na etapa 02)

- Todo visual novo fica atrás de uma chave (feature flag), por exemplo `NEW_TRADEROOM`.
- Use o sistema de flags que o projeto já tiver. Se não tiver, a IA propõe o jeito mais simples (variável de ambiente + parâmetro na URL para testar) e pede aprovação.
- **Chave desligada = plataforma idêntica à de hoje.** Isso é testado em toda etapa.
- Os estilos novos ficam **escopados** (ex.: dentro de uma classe `.theme-binmax` no contêiner da sala) para não vazar para outras páginas.

---

## 4. Dinheiro e tempo

- Payout, ganho, saldo e preço: **mostrar exatamente o que o servidor manda.** O navegador só formata.
- Formatar moeda e número com a função que o projeto já usa. Se não houver, usar `Intl.NumberFormat`.
- Horários (vencimento, fim de compra, relógio): usar a **hora do servidor**, nunca só o relógio do computador do usuário.
- O botão de abrir operação **não pode disparar duas vezes** com clique duplo ou atalho repetido.
- Fim de compra: depois do horário limite, SUBE/BAJA ficam desativados e mostram o motivo.

---

## 5. Antes de dizer "pronto"

- [ ] Build passa.
- [ ] Checagem de tipos passa (se o projeto tiver).
- [ ] Lint passa sem erro novo.
- [ ] Testes que já existiam passam.
- [ ] Testes novos desta etapa passam.
- [ ] Chave desligada: tela igual à foto do "antes".
- [ ] Chave ligada: tela conforme o plano aprovado.
- [ ] Nenhum arquivo de zona proibida aparece no `git diff`.
- [ ] Relatório da etapa gravado em `docs/relatorios/`.

---

## 6. Se algo quebrar

1. Parar. Não tentar "consertar por cima" várias vezes.
2. Mostrar o erro exato e o arquivo.
3. Voltar o último commit (`git revert` ou `git reset` do passo) e explicar o que deu errado.
4. Propor uma nova abordagem e esperar aprovação.

---

## 7. Formato do relatório de cada etapa

Gravar em `docs/relatorios/NN-nome-da-etapa.md`:

1. **Resumo** em 3 linhas.
2. **Arquivos alterados** (caminho + o que mudou).
3. **Decisões dos agentes** e conflitos resolvidos.
4. **Testes rodados** e resultado (passou / falhou / não deu para rodar e por quê).
5. **Fotos** antes e depois (caminhos).
6. **Riscos conhecidos.**
7. **Fica para depois.**
8. **Como desfazer** esta etapa.
