# Subetapa 1: Seed de Catálogo Expandido (36 Ativos Reais) & SQL Idempotente

**Orquestrador:** `tech-lead-orchestrator`  
**Modelagem Quantitativa:** `broker-architect-agent`  
**Implementação:** `backend-implementation-agent`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-01, V-13)  
**Status:** HOMOLOGADO E APROVADO (GATE 1 PASS)

---

## 1. Objetivo da Subetapa
Catalogar no PostgreSQL os **36 ativos institucionais OTC** distribuídos em 4 classes de mercado, com parâmetros estocásticos rigorosamente modelados, precisão decimal imutável e hashes gênese SHA-256 canônicos:
- **18 Pares Forex OTC** (Majors & Crosses): precisão de 5 casas (ou 3 para pares com JPY).
- **8 Pares Cripto OTC**: precisão de 2 ou 4 casas.
- **4 Commodities & Metais OTC**: Ouro, Prata, Petróleo WTI e Brent.
- **6 Índices Sintéticos de Volatilidade**: precisão de 4 casas decimais.

Além disso, fornecer o script efêmero `tests/load/seed-stress-symbols.sql` para gerar lotes dinâmicos `STRESS_0001` até `STRESS_NNNN` exclusivamente em ambientes de teste descartáveis (nunca em produção ou staging compartilhado).

---

## 2. Catálogo Oficial dos 36 Ativos

| Classe | Símbolo | Nome de Exibição | Preço Base ($p_0$) | Precisão | Volatilidade ($\sigma$) | Payout Padrão |
|---|---|---|---|---|---|---|
| Forex | `EURUSD_OTC` | EUR/USD (OTC) | 1.08540 | 5 | 0.00015 | 85% |
| Forex | `GBPUSD_OTC` | GBP/USD (OTC) | 1.29420 | 5 | 0.00018 | 85% |
| Forex | `USDJPY_OTC` | USD/JPY (OTC) | 151.850 | 3 | 0.00016 | 85% |
| Forex | `USDCHF_OTC` | USD/CHF (OTC) | 0.88450 | 5 | 0.00014 | 85% |
| Forex | `AUDUSD_OTC` | AUD/USD (OTC) | 0.65820 | 5 | 0.00016 | 85% |
| Forex | `USDCAD_OTC` | USD/CAD (OTC) | 1.38540 | 5 | 0.00015 | 85% |
| Forex | `NZDUSD_OTC` | NZD/USD (OTC) | 0.59820 | 5 | 0.00017 | 85% |
| Forex | `EURGBP_OTC` | EUR/GBP (OTC) | 0.83850 | 5 | 0.00013 | 85% |
| Forex | `EURJPY_OTC` | EUR/JPY (OTC) | 164.820 | 3 | 0.00018 | 85% |
| Forex | `GBPJPY_OTC` | GBP/JPY (OTC) | 196.540 | 3 | 0.00020 | 85% |
| Forex | `EURCAD_OTC` | EUR/CAD (OTC) | 1.48520 | 5 | 0.00016 | 85% |
| Forex | `EURAUD_OTC` | EUR/AUD (OTC) | 1.64890 | 5 | 0.00017 | 85% |
| Forex | `GBPAUD_OTC` | GBP/AUD (OTC) | 1.96600 | 5 | 0.00019 | 85% |
| Forex | `GBPCAD_OTC` | GBP/CAD (OTC) | 1.79350 | 5 | 0.00018 | 85% |
| Forex | `AUDCAD_OTC` | AUD/CAD (OTC) | 0.91180 | 5 | 0.00015 | 85% |
| Forex | `AUDJPY_OTC` | AUD/JPY (OTC) | 99.950 | 3 | 0.00018 | 85% |
| Forex | `CADJPY_OTC` | CAD/JPY (OTC) | 109.610 | 3 | 0.00017 | 85% |
| Forex | `NZDJPY_OTC` | NZD/JPY (OTC) | 90.840 | 3 | 0.00018 | 85% |
| Cripto | `BTCUSD_OTC` | BTC/USD (OTC) | 64500.00 | 2 | 0.00035 | 85% |
| Cripto | `ETHUSD_OTC` | ETH/USD (OTC) | 3450.00 | 2 | 0.00045 | 85% |
| Cripto | `SOLUSD_OTC` | SOL/USD (OTC) | 155.40 | 2 | 0.00060 | 85% |
| Cripto | `BNBUSD_OTC` | BNB/USD (OTC) | 580.50 | 2 | 0.00040 | 85% |
| Cripto | `XRPUSD_OTC` | XRP/USD (OTC) | 0.5480 | 4 | 0.00055 | 85% |
| Cripto | `ADAUSD_OTC` | ADA/USD (OTC) | 0.3540 | 4 | 0.00060 | 85% |
| Cripto | `DOGEUSD_OTC` | DOGE/USD (OTC) | 0.1145 | 4 | 0.00075 | 85% |
| Cripto | `AVAXUSD_OTC` | AVAX/USD (OTC) | 28.50 | 2 | 0.00065 | 85% |
| Commod | `XAUUSD_OTC` | Gold (OTC) | 2650.50 | 2 | 0.00020 | 85% |
| Commod | `XAGUSD_OTC` | Silver (OTC) | 31.850 | 3 | 0.00030 | 85% |
| Commod | `USOIL_OTC` | Crude Oil WTI (OTC) | 71.40 | 2 | 0.00035 | 85% |
| Commod | `UKOIL_OTC` | Brent Oil (OTC) | 75.20 | 2 | 0.00035 | 85% |
| Índices | `SYNTH_VOL_10` | Volatility 10 Index | 100.0000 | 4 | 0.00010 | 85% |
| Índices | `SYNTH_VOL_25` | Volatility 25 Index | 150.0000 | 4 | 0.00018 | 85% |
| Índices | `SYNTH_VOL_50` | Volatility 50 Index | 125.0000 | 4 | 0.00025 | 85% |
| Índices | `SYNTH_VOL_75` | Volatility 75 Index | 250.0000 | 4 | 0.00035 | 85% |
| Índices | `SYNTH_VOL_100` | Volatility 100 Index | 500.0000 | 4 | 0.00050 | 85% |
| Índices | `SYNTH_CRASH_BOOM_100` | Crash/Boom 100 Index | 1000.0000 | 4 | 0.00040 | 85% |

---

## 3. Os 6 Passos de Execução da Subetapa 1

1. **Passo 1 (Modelagem dos Parâmetros)**: Definir a tabela `indices` com JSONB `params` contendo `{ "precision": n, "sigma": f, "base_price": s, "payout_pct": 85 }`.
2. **Passo 2 (Cálculo Canônico de Gênese)**: Para cada um dos 36 ativos, calcular deterministicamente o hash gênese `SHA-256("genesis|" + symbol)` e associar ao `index_state`.
3. **Passo 3 (Criação da Migration Up Idempotente)**: Escrever `db/migrations/0010_seed_multi_assets.up.sql` com cláusulas `ON CONFLICT (symbol) DO UPDATE` para `indices` e `ON CONFLICT (symbol) DO NOTHING` para `index_state`.
4. **Passo 4 (Criação da Migration Down Reversível)**: Escrever `db/migrations/0010_seed_multi_assets.down.sql` com remoção cirúrgica dos 35 pares novos, preservando o ativo pioneiro `SYNTH_VOL_50`.
5. **Passo 5 (Proteção de Integridade por Triggers)**: Ativar o trigger `indices_precision_guard` que impede alteração do campo `precision` assim que `index_state.last_sequence > 0`.
6. **Passo 6 (Script Efêmero de Pares de Estresse)**: Disponibilizar `tests/load/seed-stress-symbols.sql` para carregar `STRESS_0001..STRESS_NNNN` sob demanda em testes de capacidade máxima ($N_{\max}$).

---

## 4. Testes de Estresse, Segurança e Caos

- **Estresse (Idempotência e Volume)**: Executar a migration `0010_seed_multi_assets.up.sql` 3 vezes consecutivas. Nenhuma duplicata, violação de chave primária ou desvio de estado é permitido.
- **Segurança (Anti-Tampering de Precisão)**: Tentativa de `UPDATE indices SET params = jsonb_set(params, '{precision}', '2') WHERE symbol = 'EURUSD_OTC'` após emissão de ticks deve falhar via trigger.
- **Caos (Rollback e Re-apply)**: Aplicar migration up, executar rollback via down, e re-aplicar up. Todos os 36 hashes gênese e estados iniciais devem ser idênticos.

---

## 5. Garantias Pós-Implementação (Skill 10)

- **`V-01`**: Todos os 36 ativos com `params.precision` cadastrado e coerente com a escala dos preços. Zero divergências.
- **`V-13`**: Fingerprint do repositório inalterado; zero enfraquecimento de asserções nos testes.

---

## 6. Critérios de Passagem do Quality Gate 1
- Executar `node tests/test-multi-01-db-seed.mjs` $\to$ Exit Code 0 (5/5 asserções aprovadas).
- Homologação independente do `post-implementation-verifier` emitindo veredito **`APROVADO`**.
