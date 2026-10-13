# Subetapa 02: Modelagem e Arquitetura do Componente `TournamentModal`

## 1. Contexto e Especificação
- **Objetivo**: Arquitetar o componente de diálogo modal `TournamentModal`, seus tipos TypeScript, o repositório de dados representativo dos 5 torneios da imagem e a máquina de estados interna (chaveamento entre visão de `'list'` e visão de `'details'`).
- **Diretrizes Arquiteturais**:
  - Modal montado sobre backdrop escurecido com blur de alta fidelidade (`rgba(5, 8, 16, 0.75)`, `backdrop-filter: blur(10px)`).
  - Fechamento imediato via tecla `Escape`, botão de fechar `✕` ou clique no backdrop.
  - Chaveamento suave entre visualização geral de torneios e visão detalhada de 3 colunas, com histórico de navegação interna.
  - Preservação estrita dos invariantes financeiros: os dados de torneio representam saldos virtuais de competição ("conta prática / saldo de torneio"), sem qualquer mutação ou impacto na carteira real.

## 2. Tipos de Dados Oficiais
- `TournamentStatus`: `'AO_VIVO' | 'EM_BREVE' | 'ENCERRADO'`
- `TournamentRuleItem`: `{ period: string; deposit: string; assets: string; criteria: string; minOps: string; }`
- `LeaderboardTrader`: `{ rank: number; name: string; country: string; returnPct: string; ops: number; }`
- `PrizePosition`: `{ position: string; prizeFormatted: string; hasGiftIcon?: boolean; }`
- `TournamentItem`:
  - `id`: string
  - `name`: string
  - `subtitle`: string
  - `status`: TournamentStatus
  - `timeBadge`: string
  - `prizeTotalFormatted`: string
  - `participants`: number
  - `actionText`: string
  - `rules`: TournamentRuleItem
  - `leaderboard`: LeaderboardTrader[]
  - `prizes`: PrizePosition[]

## 3. Arquivos Envolvidos
- `apps/web/src/components/tournaments/TournamentTypes.ts`
- `apps/web/src/components/tournaments/tournaments-mock-data.ts`
- `apps/web/src/components/tournaments/TournamentModal.tsx`
- `apps/web/src/components/tournaments/tournament-modal-arch.unit.test.tsx` (Novo teste robusto)

## 4. Plano de Testes da Subetapa
- **Testes Unitários**:
  - Renderização condicional por `isOpen={true}` e `isOpen={false}`.
  - Invocação do callback `onClose` ao pressionar Escape ou clicar no botão fechar.
  - Estado inicial na visão de lista e navegação para visão detalhada ao selecionar um torneio.
  - Retorno para visão de lista ao acionar o botão de voltar.
- **Testes de Estresse**:
  - 100 alternâncias consecutivas de abertura e fechamento sem vazamento de event listener.
- **Testes de Caos**:
  - Resiliência com array de competidores vazio ou nulo.
  - Dados com strings longas ou valores inesperados sem quebrar o layout.
- **Testes de Segurança**:
  - Ausência de injeção HTML/XSS nos nomes de competidores ou regras.

## 5. Critério de Aceite (Gate de Avanço)
- [ ] Todos os testes da Subetapa 2 executados e 100% aprovados no Vitest.
