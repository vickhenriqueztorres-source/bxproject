# 01 — Diagnóstico, ambiente e linha de base

Responsáveis: orquestrador, mapeador, arquiteto e QA. Skills 01/03/06/07/09.
Pré-condição: preservar diff local existente e não acessar produção.

## Passo a passo

1. Registrar HEAD, status, versões, schemas/runtimes e o caminho efetivo Vite → feed → gráfico. Não executar scripts de deploy.
2. Inventariar testes copiados/simulados separadamente dos que importam código real. Não chamar simulação de caos real.
3. Executar Vitest de chart/feed/candle/tick; `tsc --noEmit` de web e tick-engine; guardar stdout, stderr e exit code.
4. Enumerar containers existentes somente para evitar colisão. Compose atual usa nomes fixos; criar recursos novos com UUID, porta local dinâmica e teardown restrito ao dono.
5. Provar conexão PostgreSQL 16 e Redis 7 com deadline. Verificar que ferramentas Windows podem alcançar portas do Docker/WSL antes de depender delas.
6. Criar os oráculos da etapa 02 antes do patch. Guardar RED contra o repositório atual; os testes não podem duplicar a implementação.
7. Executar instalação das migrations em banco novo e registrar incompatibilidades; o runtime não pode ser promovido com schema incompleto.

## Critérios e testes

| ID | Dado / Quando / Então | Prova |
|---|---|---|
| AC-GD-01-1 | Dado código atual, quando executar a base, então cada falha tem arquivo, mensagem, comando e exit code | Log bruto e inventário |
| AC-GD-01-2 | Dado Docker disponível, quando criar PostgreSQL novo, então conexão e teardown funcionam sem modificar recursos compartilhados | Inspect UUID/labels, SQL SELECT 1 |
| AC-GD-01-3 | Dada mesma cadeia oficial, quando 20 escritores disputam predecessor, então só um deve confirmar | Oráculo RED antes da etapa 02 |
| AC-GD-01-4 | Dado schema vazio, quando aplicar cadeia de migrations, então incompatibilidade vira bloqueio explícito | SQL real, sem mock |

Segurança: não ler/imprimir `.env`, não reutilizar credenciais existentes, não aceitar URL arbitrária para testes destrutivos. Stress/caos de produto pertencem às próximas etapas; nesta fase são preparados, não declarados executados.
Rollback: remover somente recursos identificados por UUID da execução. Arquivos locais de terceiros nunca são restaurados em massa.

## Gate

Baseline é registro, não correção de bugs preexistentes. A evidência do defeito RED é pré-condição para corrigi-lo na etapa 02, não um PASS do produto. Dependência real inacessível bloqueia implementação. Falhas de schema bloqueiam integração das etapas 03 em diante; falhas visuais bloqueiam certificação final e qualquer mudança de UI afetada.
Saídas efetivas: `tests/reports/grafico-duravel-baseline/` e [EXECUCAO.md](EXECUCAO.md).
