# Subetapa 04: Implementação da Visão de Detalhes de 3 Colunas (Fidelidade Absoluta à Imagem 2)

## 1. Contexto e Especificação Visual
- **Fidelidade Visual (Imagem 2)**:
  - Navegação de cabeçalho: botão `← Voltar para todos os torneios` e botão `✕` para fechar.
  - Layout dividido em 3 colunas independentes e equilibradas:
  1. **Coluna Esquerda: Informações Gerais e Regras Oficiais**:
     - Badge: `● AO VIVO` (verde esmeralda).
     - Alinhamento à direita: Ícone de relógio + contador `22:51:40` em Geist Mono com destaque.
     - Título: `Copa BINMAX` (22px bold).
     - Subtítulo: `Operações de precisão` (13px, cor verde `#22C47A`).
     - Parágrafo de descrição: *"Obtenha a maior rentabilidade possível durante o período do torneio. Você opera com um saldo de torneio próprio, separado da sua conta, e o ranking atualiza a cada operação encerrada."*
     - Seção: Ícone de especificações + `Regras do torneio`.
     - Tabela de especificações com linhas sutis:
       - **Período**: `10 out, 18:00 até 11 out, 22:00 (UTC-3)`
       - **Depósito**: `Não exigido. Participe com saldo de torneio.`
       - **Ativos**: `Todos os ativos disponíveis.`
       - **Classificação**: `Maior rentabilidade percentual da conta.`
       - **Mínimo**: `10 operações para entrar no ranking.`
  2. **Coluna Central: Ranking em Tempo Real**:
     - Cabeçalho: `Ranking em tempo real`, lado direito: `1.248 participantes`.
     - Cabeçalho da tabela: `#`, `Trader`, `Rentabilidade`, `Ops`.
     - 10 posições estritas:
       - 1º: Medalha ouro `🥇` | Flag `MX` InversorMX | `+254,17%` (verde) | 38
       - 2º: Medalha prata `🥈` | Flag `CO` TraderCol | `+231,06%` (verde) | 36
       - 3º: Medalha bronze `🥉` | Flag `AR` MercadoSur | `+198,32%` (verde) | 41
       - 4º: `4` | Flag `BR` AlphaTrade | `+176,90%` | 33
       - 5º: `5` | Flag `CL` FenixCapital | `+162,54%` | 29
       - 6º: `6` | Flag `PE` MaxTrader | `+158,21%` | 37
       - 7º: `7` | Flag `US` CryptoMind | `+147,63%` | 31
       - 8º: `8` | Flag `BR` LucroTotal | `+138,09%` | 28
       - 9º: `9` | Flag `MX` VisionTrade | `+129,58%` | 34
       - 10º: `10` | Flag `BR` Ribeiro_FX | `+118,74%` | 26
  3. **Coluna Direita: Prêmios por Posição**:
     - Cabeçalho: `Prêmios por posição`.
     - Lista dos tiers de premiação com ícones de presente 🎁 e valores:
       - 🎁 `1º`: `R$ 1.000`
       - 🎁 `2º`: `R$ 500`
       - 🎁 `3º`: `R$ 300`
       - `4º`: `R$ 200`
       - `5º`: `R$ 100`
       - `6º – 10º`: `R$ 50`
       - `11º – 50º`: `R$ 20`
       - `51º – 100º`: `R$ 10`

## 2. Arquivos Envolvidos
- `apps/web/src/components/tournaments/TournamentDetailView.tsx`
- `apps/web/src/components/tournaments/CountryFlagBadge.tsx`
- `apps/web/src/components/tournaments/tournament-detail-view.unit.test.tsx` (Novo teste robusto)

## 3. Plano de Testes da Subetapa
- **Testes Unitários**:
  - Validação da renderização das 3 colunas e seus respectivos data-testids.
  - Exibição correta das medalhas para Top 3 e numerais para 4 a 10.
  - Formatação exata dos percentuais de rentabilidade e valores em reais (`R$`).
  - Disparo do botão de retorno para a lista.
- **Testes de Estresse**:
  - 100 renderizações completas da tabela de detalhes em menos de 500ms.
- **Testes de Caos**:
  - Resiliência na ausência de país no trader (fallback gracioso).
  - Tolerância a rendimentos negativos ou nulos.

## 4. Critério de Aceite (Gate de Avanço)
- [ ] Todos os testes da Subetapa 4 executados e 100% aprovados no Vitest.
