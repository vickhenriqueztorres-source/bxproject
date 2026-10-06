-- seed-stress-symbols.sql
-- ATENCAO: Executar EXCLUSIVAMENTE em ambiente descartavel (ephemeral test database).
-- NUNCA rodar em staging compartilhado ou producao, pois ticks e sequences sao append-only (I-01).
-- Cria pares de teste STRESS_0001 ate STRESS_NNNN com modelo Geometric Brownian Motion
-- identico ao SYNTH_VOL_50 (p0 = 125.0000, sigma = 0.00025, precision = 4).

DO $$
DECLARE
  n_count INTEGER := 100; -- Parametrizavel para 200, 400, 800, 1600
  i INTEGER;
  sym TEXT;
  genesis TEXT;
BEGIN
  FOR i IN 1..n_count LOOP
    sym := 'STRESS_' || LPAD(i::TEXT, 4, '0');
    -- Genesis hash: SHA-256('genesis|' || sym)
    genesis := encode(digest('genesis|' || sym, 'sha256'), 'hex');

    INSERT INTO indices (symbol, name, params, status)
    VALUES (
      sym,
      'Stress Test Symbol ' || i,
      '{"sigma": 0.00025, "precision": 4, "payout_pct": 85, "initial_price": "125.0000"}'::jsonb,
      'ACTIVE'
    ) ON CONFLICT (symbol) DO NOTHING;

    INSERT INTO index_state (symbol, last_sequence, last_price, last_hash, last_ts, lease_epoch)
    VALUES (
      sym,
      0,
      '125.0000',
      genesis,
      NOW(),
      0
    ) ON CONFLICT (symbol) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Seed concluido com % pares de estresse efemeros.', n_count;
END $$;
