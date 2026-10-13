# Subetapa 03: Implementação da Visão de Lista de Torneios (Fidelidade Absoluta à Imagem 1)

## 1. Contexto e Especificação Visual
- **Fidelidade Visual (Imagem 1)**:
  1. **Cabeçalho**:
     - Título principal: `Torneios` (28px, negrito 800, `#FFFFFF`).
     - Subtítulo: `Compita com outros traders, mostre sua estratégia e dispute prêmios em dinheiro.\nParticipação gratuita.` (13px, cor `#8A92A1`).
     - Badge lateral direito: `Torneios semanais` (ícone de troféu verde esmeralda, título em 13px negrito, subtítulo `Novos torneios toda segunda-feira.` em 11px).
  2. **Grade de 5 Cards**:
     - **Card 1 (Copa BINMAX)**:
       - Status: `● AO VIVO` (cápsula verde com ponto pulsante).
       - Prazo: `Termina em 22:51:55` (Geist Mono, alinhado à direita).
       - Ilustração: Troféu dourado sobre skyline cibernético com iluminação matricial verde.
       - Destaque: Borda esmeralda ativa `1.5px solid #22C47A` com aura difusa suave.
       - Título: `Copa BINMAX`.
       - Subtítulo: `Operações de precisão`.
       - Estatísticas: `Prêmio total: R$ 2.500` e `Participantes: 👥 1.248`.
       - Botão de ação: `Participar →` (fundo verde `#22C47A`, texto escuro `#08140B`, peso 700).
     - **Card 2 (Desafio da Semana)**:
       - Status: `EM BREVE`, `Começa em 1d 09h 51m`, troféu prateado, `Estratégia sem limites`, Prêmio `R$ 1.000`, `532 participantes`, botão `Ver detalhes`.
     - **Card 3 (Mestres dos Sintéticos)**:
       - Status: `EM BREVE`, `Começa em 3d 18h 51m`, troféu bronze/âmbar, `Somente índices Vol`, Prêmio `R$ 3.000`, `421 participantes`, botão `Ver detalhes`.
     - **Card 4 (Desafio Express)**:
       - Status: `ENCERRADO`, `Encerrou em 03 de out.`, troféu monocromático, `Operações de 5 minutos`, Prêmio `R$ 800`, `982 participantes`, botão `Ver resultado`.
     - **Card 5 (Campeões do Mês)**:
       - Status: `ENCERRADO`, `Encerrou em 30 de set.`, troféu monocromático, `Todas as categorias`, Prêmio `R$ 5.000`, `2.156 participantes`, botão `Ver resultado`.

## 2. Arquivos Envolvidos
- `apps/web/src/components/tournaments/TournamentListView.tsx`
- `apps/web/src/components/tournaments/TournamentCard.tsx`
- `apps/web/src/components/tournaments/TournamentTrophyArt.tsx`
- `apps/web/src/components/tournaments/tournament-list-view.unit.test.tsx` (Novo teste robusto)

## 3. Plano de Testes da Subetapa
- **Testes Unitários**:
  - Renderização precisa de cada um dos 5 cards com seus respectivos textos, valores e badges.
  - Verificação da borda esmeralda exclusiva no card "Copa BINMAX".
  - Disparo de navegação com ID correto ao clicar em "Participar →", "Ver detalhes" e "Ver resultado".
- **Testes de Estresse**:
  - Renderização rápida dos 5 cards em série 100 vezes em menos de 500ms.
- **Testes de Caos**:
  - Truncamento gracioso de nomes de torneio extremamente longos (text-overflow: ellipsis).
- **Testes de Acessibilidade**:
  - Botões com atributos semânticos adequados e suporte a navegação por teclado.

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Todos os testes da Subetapa 3 executados e 100% aprovados no Vitest.
