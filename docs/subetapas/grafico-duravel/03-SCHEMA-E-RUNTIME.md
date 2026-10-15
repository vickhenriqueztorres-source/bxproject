# 03 — Unificar contrato de schema e runtime

Agentes: arquiteto, backend, QA, segurança. Skills 01/03/06/08/09/10.
Pré-condição: gate 02 VALIDADA; runtime escolhido por ADR com compatibilidade explicitada.
Escopo: migrations aditivas novas em `db/migrations/`, um adapter de persistência e seus testes. Não reescrever migrations já aplicadas nem trocar imagem PostgreSQL.

## Passo a passo

1. Escrever teste RED: aplicar 0001, roles e migrations seguintes em ordem num PostgreSQL 16 vazio. Capturar primeiro erro e todas as dependências entre tabelas/colunas/roles.
2. Inventariar contrato exigido pelos runtimes TS/MJS: `indices.params`, `last_ts`, `lease_epoch`, `outbox` versus `outbox_events`, referências de ticks dos contratos e grants.
3. Escolher um runtime alvo e registrar ADR. Se a cadeia histórica não instala do zero, criar bootstrap versionado e caminho de upgrade explícitos; não fingir que uma migration posterior conserta uma anterior que impede chegar até ela.
4. Dividir expansão em patches <=5 arquivos/150 linhas: catálogo/estado; ticks/hash; outbox; referências de contratos; roles e triggers.
5. Testar instalação vazia e upgrade de snapshot descartável; exigir contagens e hashes anteriores intactos. Não tratar história legada fabricada como ticks oficiais.
6. Provar append-only e regras de sequência/hash no banco, inclusive sob chamadas SQL diretas com role de serviço.
7. Validar reversibilidade antes de novos dados e estratégia forward-only após contratos dependerem do schema expandido.

## Testes de aceite

- AC-GD-03-1: dado banco vazio, ao instalar pelo bootstrap oficial e migrations, todos os serviços alvo consultam as tabelas reais sem coluna ausente.
- AC-GD-03-2: dado snapshot anterior, ao expandir, nenhum tick/contrato é alterado, omitido ou renumerado; hash antes = depois.
- AC-GD-03-3: dado app_tick, ao tentar UPDATE/DELETE/TRUNCATE de ticks, DDL ou salto de sequência, PostgreSQL rejeita; tentativa inválida não cria outbox.
- AC-GD-03-4: dado 20 transações e locks, migration respeita lock_timeout/statement_timeout e falha sem alteração parcial quando bloqueada.
- AC-GD-03-5: dado backup do ambiente efêmero, restore reproduz contagens, cabeças de cadeia e referências.

Stress: medir lock/IO sob 36 símbolos ×1 Hz no ambiente de capacidade, sem afirmar que a VPS tem os mesmos tempos. Caos: matar sessão de migration antes de COMMIT, comprovar rollback e reaplicação segura.
Segurança: privilégios mínimos por serviço, owner NOLOGIN, nenhuma credencial real nos logs. Blnk permanece dono do saldo.
Gate: cadeia de instalação/upgrade/restore verde, zero violação SQL e revisão de schema/segurança. Política de retenção ainda não definida não autoriza exclusão de ticks.
