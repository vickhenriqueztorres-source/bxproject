# Apresentação para a banca

A banca é o usuário da Fase 1. A meta do PRD de "100 usuários beta" vira: **cada avaliador consegue
completar a jornada sozinho**, e o sistema prova que não perde dinheiro quando algo cai.

## Mensagem central

> "Construí só o núcleo — gerador de preço, contrato e liquidação — e integrei o resto (Keycloak, Blnk,
> Lightweight Charts, Redis, Postgres). Cada garantia financeira é provada por um teste que derruba uma peça
> do sistema de propósito. A IA escreveu o código sob guardas, e eu medi onde ela errou."

## Roteiro (≈ 25 min)

| Bloco | Tempo | O que mostrar | Apoio |
|---|---|---|---|
| 1. Problema e escopo | 2 min | Personas, o que está dentro e fora da Fase 1 | PRD §2, §6 |
| 2. Arquitetura | 4 min | Diagrama; o que é integrado × construído; Stream (confiável) × Pub/Sub (visual); outbox | ORCHESTRATOR §7 |
| 3. Demo do usuário | 6 min | Cadastro → e-mail no Mailpit → login → `US$ 10.000,00` → gráfico ao vivo → UP de US$ 10 → resultado em 60 s → saldo muda → histórico filtrado | OR-25 |
| 4. Demo do admin | 3 min | Login com TOTP → usuários com saldo → contratos → **pausar índice** → boleta do aluno bloqueia → retomar | OR-26 |
| 5. Resiliência ao vivo | 4 min | Com contrato aberto: `docker kill` no settlement worker → reinicia → liquida **uma vez**; Grafana mostra o alerta e a reconciliação em 0 | OR-21, OR-23 |
| 6. Evidências | 3 min | Tabela da Definição de Pronto com os 14 itens; resultado da carga (p95, 5xx, divergência) | `relatorio-fase-1/` |
| 7. IA no desenvolvimento | 3 min | Falhas por classe (F-xx), camada que pegou cada uma, o que escapou para a revisão humana | `ai-failures.jsonl` |
| 8. Limitações e Fase 2 | 1 min | Subtasks BLOCKED (se houver), RDS, multi-país, dinheiro real | `RESUMO.md` |

## Véspera (D-1)

- [ ] `pnpm run demo:up && pnpm run demo:seed` na máquina da apresentação, rede da faculdade incluída
- [ ] Contas seed testadas; **TOTP do ADMIN cadastrado no seu celular** (ADMIN exige MFA)
- [ ] Mailpit aberto numa aba (cadastro ao vivo)
- [ ] Grafana com o dashboard da Fase 1 e o painel de alertas
- [ ] Comando do bloco 5 num terminal pronto: `docker compose -p fase1-demo kill settlement-worker`
- [ ] Gravação de tela da jornada completa (plano B)
- [ ] Slides com o diagrama, a tabela da Definição de Pronto e a tabela do TCC

## Plano B

| Falhou | Faça |
|---|---|
| Rede da faculdade | Stack roda local; o front aponta para `localhost` |
| Cadastro/e-mail | Use `aluno@demo.local` já criado |
| Algo trava na demo | Mostre a gravação e, em seguida, o teste automatizado do mesmo fluxo passando |
| Resiliência ao vivo não liquida | Mostre a evidência do `C-08`/`OR-21` em `relatorio-fase-1/` e explique a fila humana |

## Perguntas prováveis

| Pergunta | Resposta curta |
|---|---|
| Por que não `Math.random()`? | Previsível; o preço precisa de CSPRNG (`crypto`) para não ser antecipado (D-07) |
| E se o Redis cair? | O tick já está no Postgres antes de publicar (outbox). O Stream republica; o front faz catch-up por `sequence` (OR-20) |
| Como garante que não paga duas vezes? | Chave idempotente por contrato no Blnk + `SKIP LOCKED` + constraint no banco; testado com 2 workers e com `kill -9` (OR-13, OR-21) |
| Por que Blnk e não uma tabela de saldo? | Ledger de dupla entrada append-only pronto; saldo é derivado, não editado (D-02) |
| A IA não inventou os testes? | Os 26 oráculos foram escritos e assinados por mim antes; o gate exige o ID no teste executado. Evidência é saída de comando, não texto da IA |
| O que a IA errou? | Tabela do bloco 7: classe, onde, quem pegou |
| Como é o empate? | Preço de saída igual ao de entrada: stake devolvido |
| E o arredondamento do 85 %? | `floor(stake × 85 / 100)` em centavos, decisão D-19 |
| Por que USD se o foco é LatAm? | Fase 1 tem uma moeda (fora de escopo: múltiplas moedas); moeda local entra na Fase 2 |
