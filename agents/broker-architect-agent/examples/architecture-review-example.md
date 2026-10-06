# Exemplo de Parecer Arquitetural e Análise Forense de Rupturas (FMEA)

Este exemplo demonstra o padrão de excelência técnica e profundidade com que o `broker-architect-agent` analisa uma proposta e modela soluções para a plataforma.

---

## 1. Contexto da Análise
Uma equipe propôs a seguinte implementação ingênua para agregação de preços e risco:
- Geração de ticks usando `Math.random()`.
- Agregação de velas em uma variável global em memória RAM: `let currentCandle = { open, high, low, close }`.
- Checagem de saldo do usuário direto em uma tabela SQL: `UPDATE users SET balance = balance - stake`.
- Consulta do preço de settlement pegando o último tick na memória do processo Node.js.

---

## 2. Parecer Técnico do Arquiteto (FMEA)

### Falha Fatal 1: Predictability Attack (CSPRNG vs Math.random)
- **Diagnóstico:** O algoritmo de números pseudo-aleatórios do V8 (Node.js) é o `xorshift128+`. Um bot monitorando 15 a 20 ticks consecutivos consegue reconstruir o estado interno do gerador e prever com 100% de precisão as próximas cotações, sangrando o capital da corretora.
- **Solução Arquitetural:** Obrigatoriedade de CSPRNG do kernel via `crypto.randomBytes(8)` com transformação Box-Muller e encadeamento SHA-256 no tick anterior.

### Falha Fatal 2: Corrupção por Reinicialização (RAM Candle Aggregator)
- **Diagnóstico:** Se o processo Node.js sofrer OOM ou reiniciar às 14:02:45, a vela do minuto é completamente apagada, corrompendo a integridade do gráfico e impossibilitando auditoria regulatória.
- **Solução Arquitetural:** O tick é persistido na mesma transação ACID do Outbox antes de qualquer emissão. A vela ativa é mantida no Redis com script Lua atômico e selada no PostgreSQL com `UPSERT` idempotente.

### Falha Fatal 3: Quebra da Equação Contábil (Tabela Solta de Saldo)
- **Diagnóstico:** Modificar saldos em tabelas relacionais com `UPDATE balance` não deixa trilha de dupla entrada, é vulnerável a concorrência e não previne desvios de saldo.
- **Solução Arquitetural:** Uso exclusivo do Blnk Finance Core com contabilidade de partidas dobradas e referências idempotentes em cada débito e crédito.
