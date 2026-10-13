# Checklist de testes

Cada etapa diz quais blocos rodar. Na etapa 12 roda tudo.

**Legenda:** `[A]` automático (a IA escreve e roda) · `[M]` manual (você ou a IA no navegador)

---

## 1. Básico (toda etapa)

- [ ] `[A]` Build de produção passa.
- [ ] `[A]` Checagem de tipos passa.
- [ ] `[A]` Lint sem erro novo.
- [ ] `[A]` Todos os testes que já existiam passam.
- [ ] `[M]` Console do navegador sem erro novo.
- [ ] `[M]` Chave liga/desliga **desligada**: tela igual à foto do "antes".

---

## 2. Operação (etapas 07, 08 e 12)

- [ ] `[A]` Abrir operação **SUBE** com valor válido → aparece no gráfico e no portfólio.
- [ ] `[A]` Abrir operação **BAJA** com valor válido → idem.
- [ ] `[A]` **Clique duplo** em SUBE abre **uma** operação só.
- [ ] `[A]` Valor abaixo do mínimo → botão desativado + mensagem.
- [ ] `[A]` Valor acima do máximo → botão desativado + mensagem.
- [ ] `[A]` Saldo insuficiente → mensagem "Saldo insuficiente. Deposita y sigue operando." + atalho para depositar.
- [ ] `[A]` Depois do fim de compra → SUBE/BAJA desativados.
- [ ] `[M]` Operação vence → resultado aparece, saldo atualiza com o valor **do servidor**.
- [ ] `[M]` Payout muda no servidor → ticket atualiza sem recarregar.
- [ ] `[M]` Ativo fecha → aviso claro, botões desativados.
- [ ] `[M]` Troca de ativo com operação aberta → operação continua no portfólio.
- [ ] `[M]` Conta demo e conta real: trocar, operar, conferir que o saldo certo mudou.

## 3. Atalhos de teclado

- [ ] `[A]` Se o sistema já tinha atalhos de teclado, eles continuam funcionando (não criar atalhos novos).
- [ ] `[M]` Teste de sobreposição com `docs/referencias/iq-traderoom-desktop.png` (seção 8 de `docs/dashboard-ux.md`): cada elemento A1–F no mesmo lugar, com tolerância de 10px.
- [ ] `[A]` Atalhos **não** disparam enquanto o cursor está num campo de texto.
- [ ] `[A]` Segurar a tecla não abre várias operações.

## 4. Conexão

- [ ] `[M]` Cortar a internet → aviso "Sin conexión", botões desativados.
- [ ] `[M]` Voltar a internet → reconecta, preços voltam, nada duplicado.
- [ ] `[M]` Aba do navegador em segundo plano por 10 min → ao voltar, preço e relógio corretos.

## 5. Visual (etapas 03 a 11)

Tirar foto em cada tamanho, com a chave **ligada** e **desligada**:

| Tamanho | Por quê |
|---|---|
| 1366 × 768 | Notebook mais comum na América Latina |
| 1440 × 900 | Notebook |
| 1920 × 1080 | Monitor |
| 2560 × 1440 | Monitor grande |
| 768 × 1024 | Tablet |
| 390 × 844 | iPhone |
| 360 × 800 | Android mais comum |

- [ ] `[M]` Nada cortado, sobreposto ou fora da tela.
- [ ] `[M]` Nomes de ativos completos nas abas.
- [ ] `[M]` Verde só em dinheiro (saldo, ganho, SUBE, Depositar).
- [ ] `[M]` SUBE e BAJA do mesmo tamanho.

## 6. Navegadores

- [ ] `[M]` Chrome (Windows e Android)
- [ ] `[M]` Safari (iPhone e Mac)
- [ ] `[M]` Edge
- [ ] `[M]` Firefox

## 7. Acessibilidade (etapa 11)

- [ ] `[A]` Ferramenta automática (axe ou Lighthouse) sem erro grave.
- [ ] `[M]` Dá para operar só com teclado (Tab, Enter, atalhos).
- [ ] `[M]` Foco sempre visível (contorno prata).
- [ ] `[M]` Leitor de tela anuncia o resultado da operação.
- [ ] `[M]` Com "reduzir movimento" ligado no sistema, sem animação de deslizar.

## 8. Desempenho (etapa 11)

- [ ] `[M]` Gráfico a 60 quadros por segundo com 3 abas abertas.
- [ ] `[M]` Memória não cresce sem parar depois de 30 min aberto.
- [ ] `[M]` Tick de preço não re-renderiza a página inteira (só o que muda).
- [ ] `[M]` Carregamento inicial não piorou em relação ao "antes".

## 9. Regressão do resto da plataforma (etapa 12)

- [ ] `[M]` Cadastro e login.
- [ ] `[M]` Recuperar senha.
- [ ] `[M]` Depósito (até a tela do gateway).
- [ ] `[M]` Saque (até a confirmação).
- [ ] `[M]` Verificação de identidade.
- [ ] `[M]` Histórico de operações e extrato.
- [ ] `[M]` Links de afiliado e campanhas abrem a página certa.
- [ ] `[M]` Eventos de analytics continuam disparando (abrir operação, depositar, cadastro).
