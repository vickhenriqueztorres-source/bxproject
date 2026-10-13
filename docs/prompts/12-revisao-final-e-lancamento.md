# Etapa 12 — Revisão final e lançamento

**Objetivo:** provar que tudo funciona, lançar aos poucos e ter um plano de volta pronto.
**Mexe no código?** Só correções de problemas encontrados.
**Entrega:** `docs/relatorios/12-lancamento.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada. Use todos os relatórios em docs/relatorios/ e confirme no código.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/prompts/checklist-de-testes.md (inteiro)
4. docs/dashboard-ux.md (seção "Métricas para validar o design")
5. Todos os relatórios em docs/relatorios/ (01 a 11)

OBJETIVO DESTA ETAPA
1. Rodar o checklist-de-testes.md INTEIRO (seções 1 a 9), com a chave ligada e desligada.
2. Revisar o git diff completo da branch contra a main.
3. Corrigir só o que estiver quebrado (com aprovação).
4. Preparar o lançamento gradual e o plano de volta.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — VERIFICAR
- Rodar todos os testes automáticos.
- Executar os testes manuais (ou listar exatamente quais eu preciso fazer, com passo a passo).
- Fotos finais em todos os tamanhos, chave ligada e desligada, ao lado das fotos do "antes".
- Revisar o git diff: listar todo arquivo alterado e confirmar que nenhum está na lista de zonas proibidas do relatório 01.
- Procurar no diff: console.log esquecido, valores fixos falsos, cores fora dos tokens, textos em inglês/português, TODOs.

FASE 2 — CONSELHO DOS AGENTES (revisão final)
- Fidelidade IQ: teste de sobreposição final (seção 8 de docs/dashboard-ux.md) com todos os elementos A1–F, em desktop e celular. Cada elemento: IGUAL / D# / fora do lugar. Conferir a seção 5 ("O que NÃO fazer") item por item. Um único "fora do lugar" reprova.
- Marca Binmax: conferir as tabelas de troca de cores (seção 2) e de textos (seção 3), uma linha por vez: aplicado / não aplicado.
- Compliance e Risco: conferir SUBE/BAJA iguais, aviso de risco, demo/real, nenhum texto proibido.
- Guardião de Regressão: lista de testes com resultado; o que não deu para testar e por quê.
- Mapeador: riscos técnicos que restaram.
- Engenheiro de Prompt: veredito "PRONTO PARA LANÇAR" ou "NÃO PRONTO" com os motivos.

FASE 3 — PLANO DE LANÇAMENTO (e PARE)
Proponha:
1. Lançamento gradual com a chave:
   - Fase A: só equipe interna.
   - Fase B: 5% dos usuários (de preferência começando por contas demo).
   - Fase C: 25%.
   - Fase D: 100%.
   - Tempo mínimo em cada fase e quem decide avançar.
2. Métricas a acompanhar em cada fase (comparando chave ligada x desligada): tempo até a 1ª operação, operações por sessão, cliques em Depositar, taxa de erro ao abrir operação, tickets de suporte, erros no console/monitoramento.
3. Gatilhos para voltar imediatamente: aumento de erro ao abrir operação, operação duplicada, saldo errado, queda forte de operações.
4. Plano de volta: desligar a chave (sem deploy), e quem pode fazer isso.
5. Plano para depois de 100%: quando remover o código antigo (em outra etapa, com outro plano).
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
- Corrigir problemas aprovados, um commit por correção, rodando o checklist afetado de novo.
- Preparar o pull request com: resumo, lista de etapas, fotos antes/depois, como testar, como desligar.
- NÃO fazer merge nem deploy. Isso é decisão minha.

FASE 5 — RELATÓRIO
Grave docs/relatorios/12-lancamento.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com o veredito, a tabela de fidelidade A1–F (com fotos ao lado da IQ) e o plano de lançamento aprovado.
````

---

## O que você confere

- [ ] O veredito é "PRONTO PARA LANÇAR".
- [ ] Você mesmo abriu operações em demo no desktop e no celular.
- [ ] Sabe desligar a chave em menos de 1 minuto.
- [ ] Alguém está olhando as métricas na Fase B.

## Nunca

- Lançar para 100% direto.
- Fazer merge numa sexta à noite.
- Remover o código antigo na mesma entrega.
