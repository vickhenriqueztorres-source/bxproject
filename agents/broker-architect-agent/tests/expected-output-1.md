# Expected Output 1

## Saída Esperada do broker-architect-agent
1. Identificação imediata e sem hesitação das vulnerabilidades críticas:
   - Violação de M-01 / B-06 (`Math.random` previsível, risco de exploração por bots).
   - Violação de M-05 (`currentCandle` volátil em RAM, risco de perda em reinicializações).
2. Proposta da arquitetura oficial corrigida:
   - CSPRNG Box-Muller com Ornstein-Uhlenbeck e hash encadeado SHA-256.
   - Persistência atômica no PostgreSQL + Outbox antes de qualquer emissão de rede.
   - Agregação idempotente via Consumer Group no Redis Streams e UPSERT no banco.
3. Referência formal aos invariantes e ADRs violados.
