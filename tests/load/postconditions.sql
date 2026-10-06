-- ============================================================================
-- Quality Gate 7: Postconditions Audit (SQL Integrity & Financial Invariants)
-- Verificações formais executadas após testes de carga (E1, E2, E3, E4)
-- ============================================================================

-- 1. Verificação de Integridade de Sequência de Ticks (Sem Saltos ou Lacunas)
-- Para cada símbolo, max(sequence) - min(sequence) + 1 DEVE ser igual a count(*)
WITH seq_check AS (
    SELECT 
        symbol,
        count(*) AS total_ticks,
        min(sequence) AS min_seq,
        max(sequence) AS max_seq,
        (max(sequence) - min(sequence) + 1) AS expected_ticks
    FROM ticks
    GROUP BY symbol
)
SELECT 
    symbol,
    total_ticks,
    min_seq,
    max_seq,
    expected_ticks,
    CASE 
        WHEN total_ticks = expected_ticks THEN 'PASS: SEQUENCIA_CONTIGUA'
        ELSE 'FAIL: LACUNA_OU_SALTO_DETECTADO'
    END AS sequence_status
FROM seq_check
WHERE total_ticks != expected_ticks;

-- 2. Verificação de Inviolabilidade Anti-Cross (Tolerância Zero)
-- 100% dos contratos liquidados DEVEM ter exit_tick do MESMO símbolo do contrato
SELECT 
    c.id AS contract_id,
    c.symbol AS contract_symbol,
    t.symbol AS exit_tick_symbol,
    'CRITICAL_VIOLATION: CROSS_ASSET_SETTLEMENT' AS error_description
FROM contracts c
JOIN ticks t ON c.exit_tick_id = t.id
WHERE c.status = 'SETTLED'
  AND c.symbol != t.symbol;

-- 3. Verificação de Payout e Regras Financeiras (I-01 a I-06)
-- Payout calculado rigorosamente como: WIN -> stake + 85%, DRAW -> stake, LOSS -> 0
SELECT 
    id,
    symbol,
    result,
    stake_minor,
    payout_minor,
    CASE result
        WHEN 'WIN' THEN stake_minor + ((stake_minor * 85) / 100)
        WHEN 'DRAW' THEN stake_minor
        WHEN 'LOSS' THEN 0
        ELSE -1
    END AS expected_payout_minor,
    'FAIL: PAYOUT_INCORRETO' AS error_description
FROM contracts
WHERE status = 'SETTLED'
  AND payout_minor != CASE result
        WHEN 'WIN' THEN stake_minor + ((stake_minor * 85) / 100)
        WHEN 'DRAW' THEN stake_minor
        WHEN 'LOSS' THEN 0
        ELSE -1
      END;

-- 4. Verificação de Outbox Exactly-Once (Sem duplicações ou eventos perdidos)
SELECT 
    c.id,
    c.symbol,
    count(o.id) AS outbox_events_count,
    'FAIL: OUTBOX_EVENT_MISMATCH' AS error_description
FROM contracts c
LEFT JOIN outbox o ON o.dedupe_key = 'settled:event:' || c.id
WHERE c.status = 'SETTLED'
GROUP BY c.id, c.symbol
HAVING count(o.id) != 1;

-- 5. Verificação de Status do Catálogo (Nenhum contrato em símbolo inválido)
SELECT 
    c.id,
    c.symbol,
    i.status AS index_status,
    'FAIL: CONTRATO_EM_ATIVO_INVALIDO' AS error_description
FROM contracts c
LEFT JOIN indices i ON c.symbol = i.symbol
WHERE i.symbol IS NULL;
