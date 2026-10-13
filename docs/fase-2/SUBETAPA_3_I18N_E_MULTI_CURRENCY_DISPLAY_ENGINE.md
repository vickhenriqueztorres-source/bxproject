# SUBETAPA 3: MOTOR MULTI-MOEDA DE EXIBIÇÃO & CÂMBIO DE REFERÊNCIA

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agentes Executores:** `backend-implementation-agent`, `frontend-realtime-agent`  
**Agentes Revisores e Auditores:** `financial-correctness-reviewer`, `broker-architect-agent`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-03`

---

## 1. Objetivo e Escopo

Implementar a camada desacoplada de **Multi-Moeda de Exibição (Display Currency)** para os 6 países da América Latina (`BRL`, `MXN`, `COP`, `ARS`, `CLP`, `PEN`), assegurando:
1. **Preservação Absoluta do Ledger**: A carteira demo do usuário no Blnk continua operando 100% em **centavos de USD** (`USD_minor`, inteiro int64). Nenhum cálculo de conversão ou float penetra no ledger ou na liquidação de contratos.
2. **Serviço de Câmbio de Referência** (`ExchangeRateService`):
   - Cache em Redis (`broker:rates:usd`) alimentado a partir da tabela `display_currencies` do PostgreSQL.
   - Endpoint `GET /api/v1/currencies` listando as 6 moedas, taxas em relação ao USD, símbolos (`R$`, `Mex$`, `Col$`, `$`, `CLP$`, `S/.`) e número de casas decimais.
   - Endpoint `POST /api/v1/currencies/convert` para cálculo e preview de conversão estritamente informativo.
3. **Módulo de Formatação Regional** no pacote compartilhado (`packages/shared/src/currency.ts`):
   - Formatação robusta via `Intl.NumberFormat` respeitando o locale do país (`pt-BR`, `es-MX`, `es-CO`, `es-AR`, `es-CL`, `es-PE`).
   - Suporte a moedas sem centavos tradicionais (ex.: `CLP` e `COP` frequentemente formatados sem fração decimal) e com centavos (`BRL`, `MXN`, `PEN`, `ARS`).

---

## 2. Invariantes Financeiras e Regras Críticas

- **I-01 / I-02 / D-18 (Ancoragem em USD)**: Todo contrato aberto no backend é faturado e liquidado em `stake_minor` (centavos de USD). A moeda regional é apenas uma projeção visual no cliente para enriquecer a experiência do trader local.
- **I-04 (Zero Float no Ledger)**: Em hipótese alguma o backend fará débitos ou créditos no Blnk com base no valor convertido em moeda local. O saldo original recuperado do Blnk é sempre US$ 10.000,00 (`1_000_000` centavos).
- **Consistência Determinística**: A conversão de exibição utiliza taxas oficiais registradas na base com timestamp e versão, evitando discrepâncias entre telas.

---

## 3. Especificação das Moedas e Locales

| País | Moeda | Símbolo | Locale | Decimais | Taxa Referência inicial (USD) | Exemplo de US$ 10.000,00 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Brasil (`BR`) | `BRL` | `R$` | `pt-BR` | 2 | 5.500000 | R$ 55.000,00 |
| México (`MX`) | `MXN` | `Mex$` | `es-MX` | 2 | 19.500000 | Mex$ 195.000,00 |
| Colômbia (`CO`) | `COP` | `Col$` | `es-CO` | 0 | 4150.000000 | Col$ 41.500.000 |
| Argentina (`AR`) | `ARS` | `$` | `es-AR` | 2 | 980.000000 | $ 9.800.000,00 |
| Chile (`CL`) | `CLP` | `CLP$` | `es-CL` | 0 | 940.000000 | CLP$ 9.400.000 |
| Peru (`PE`) | `PEN` | `S/.` | `es-PE` | 2 | 3.750000 | S/. 37.500,00 |

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-currency-formatting.test.ts`)
- Formatação das 6 moedas cobrindo centavos, milhares e símbolos oficiais.
- Conversão de `stake_minor` USD para cada moeda de exibição garantindo ausência de erros de precisão IEEE 754.
- Comportamento com moedas de zero casas decimais (`CLP`, `COP`).

### 4.2 Testes de Integração (`tests/integration/test-exchange-rates-api.test.ts`)
- Verificação do endpoint `GET /api/v1/currencies` contra o banco de dados e cache Redis.
- Verificação de que abertura de contrato `POST /contracts` continua recebendo estritamente `stake_minor` em USD e não aceita moedas fiduciárias arbitrárias no corpo da requisição.

### 4.3 Auditoria Financeira (`financial-correctness-reviewer`)
- Verificação do fluxo de abertura e liquidação de contrato sob visão de moeda regional: o ledger do Blnk registra exclusivamente `USD_minor`.

### 4.4 Testes de Estresse
- Execução de 50.000 conversões em paralelo no worker/API medindo tempo médio por conversão < 0.05ms.

### 4.5 Testes de Caos
- Taxas de câmbio do Redis expiradas ou indisponíveis: fallback instantâneo para valores padrão seguros gravados no PostgreSQL sem interrupção de serviço.

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-03`)
A Subetapa 3 é considerada HOMOLOGADA exclusivamente se:
1. As 6 moedas são formatadas perfeitamente nos seus respectivos idiomas e símbolos.
2. O endpoint de taxas e moedas responde com cache Redis e fallback resiliente.
3. Auditoria formal do `financial-correctness-reviewer` certifica conformidade com `I-01` a `I-06`.
4. Todos os testes passam e o `post-implementation-verifier` homologa o gate.
