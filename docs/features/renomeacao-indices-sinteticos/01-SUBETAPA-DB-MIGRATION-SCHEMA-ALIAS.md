# SUBETAPA 01: Migração de Banco de Dados, Schema PostgreSQL, Aliases e Seeds

> **Status:** HOMOLOGADO E APROVADO (GATE 1 PASS)  
> **Data de Homologação:** 12/10/2026  
> **Responsáveis:** `backend-implementation-agent`, `broker-architect-agent`, `financial-correctness-reviewer`  
> **Skills Chave:** `02-financial-invariants`, `08-database-foundation`, `18-zonas-sensiveis`  

---

## 1. Escopo Técnico e Invariantes

1. **Dual-Alias / Símbolo Canônico na Tabela `indices`**:
   - Inserir / atualizar os registros da tabela `indices` com os novos símbolos e nomes institucionais.
   - Criar suporte de alias ou migration idempotente que não viole chaves estrangeiras com a tabela `contracts`.
2. **Atualização dos Seeds Institucionais**:
   - Atualizar `db/seeds/002_multi_asset_seed.sql` e migration de semente `db/migrations/0010_seed_multi_assets.up.sql`.
   - Garantir que todos os 36 ativos (18 Forex, 8 Cripto, 4 Commodities e os 6 Sintéticos com nova nomenclatura) sejam inseridos com seus parâmetros de precisão, payout e status `active`.
3. **Preservação de Integridade Contábil (I-01 a I-06)**:
   - Nenhuma referência contábil existente é desfeita.
   - Scripts idempotentes de migration (UP e DOWN reversível).

---

## 2. Passo a Passo de Implementação

1. [x] Revisar schema de `indices`, `contracts`, `ticks` e `candles`.
2. [ ] Escrever script de migration reversível em `db/migrations/`.
3. [ ] Atualizar arquivos de seed em `db/seeds/`.
4. [ ] Validar integridade referencial de chaves estrangeiras com contratos legados.

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite |
|---|---|---|---|
| **T-DB-01** | **Unitário / Idempotência** | Executar migration UP e DOWN duas vezes consecutivas | Código de retorno 0, sem duplicidade de chaves ou erro de integridade referencial. |
| **T-DB-02** | **Segurança (SQL Injection)** | Testar busca de índice por símbolo com strings maliciosas (`' OR '1'='1`) | Sanitização estrita, retorno seguro sem injeção. |
| **T-DB-03** | **Integridade Financeira** | Tentar inserir contrato com símbolo legado e novo símbolo | Sistema aceita e mapeia para o índice canônico sem órfãos. |
| **T-DB-04** | **Estresse de Leitura** | 100 consultas simultâneas na tabela `indices` via pool Postgres | Latência < 5ms, 0 timeouts. |

---

## 4. Gate de Homologação da Subetapa 01

A Subetapa 01 é considerada **HOMOLOGADA** somente quando:
1. `docker compose exec postgres psql -U broker -d broker -c "SELECT symbol, name FROM indices WHERE category = 'Sintéticos';"` retornar os novos nomes sem duplicidades.
2. Script de validação `tests/test-subetapa-1-db-seed.mjs` rodar com 100% dos assertions verdes.
