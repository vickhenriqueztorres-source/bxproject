# Subetapa 3: Janela de Tempo & Validação de Sincronização entre Ativos

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Skills Chave:** `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`  
**Invariantes:** I-01 (Preservação de saldo), B-01 (Execução justa de ordens)

---

## 1. Escopo e Objetivos da Subetapa
Garantir que qualquer comparação, exibição em paridade ou eventual contrato multi-ativo (spread, par cruzado, cesta) seja executado **exclusivamente se ambos os ativos possuírem cotações dentro de uma janela de tempo estreita e sincronizada ($\Delta t \le 2.000\text{ms}$)**. Eliminar qualquer possibilidade de comparar o preço atual do Bitcoin com o preço do Ethereum de 10 segundos atrás, bloqueando arbitragem de latência e distorção de spread.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 3.1: Definição da Tolerância Máxima de Skew Cross-Asset
- **Ação:** Definir `MAX_CROSS_ASSET_SKEW_MS = 2000` (2.000ms).
- **Critério de Aceite:** Limite rígido padronizado na indústria para correlação de mercado financeiro.

### Passo 3.2: Função Validadora Atômica `validateCrossAssetSync`
- **Ação:** Criar função pura e determinística:
  ```ts
  function validateCrossAssetSync(tickA: Tick, tickB: Tick): { synchronized: boolean; skewMs: number; error?: string }
  ```
  * Calcula $\text{skewMs} = |tickA.event\_time - tickB.event\_time|$.
  * Se $\text{skewMs} > MAX\_CROSS\_ASSET\_SKEW\_MS$, retorna `{ synchronized: false, error: 'CROSS_ASSET_DESYNCHRONIZED' }`.
- **Critério de Aceite:** Execução em $< 0.1\mu s$ sem alocação desnecessária de memória.

### Passo 3.3: Validação Pré-Ordem para Operações Cruzadas
- **Ação:** No `ContractService` e no `RiskManager`, caso uma operação dependa de mais de um índice:
  * Verificar frescor individual ($\text{age} \le 5000\text{ms}$).
  * Verificar sincronização mútua ($\text{skew} \le 2000\text{ms}$).
  * Abortar imediatamente com código `CROSS_ASSET_DESYNCHRONIZED` se falhar.
- **Critério de Aceite:** Zero ordens executadas com cotações desalinhadas.

### Passo 3.4: Rejeição no Gateway para Subscrições Multi-Ativos Descompassadas
- **Ação:** No WebSocket Gateway, ao sincronizar feeds para gráficos combinados, enviar tag de aviso se um dos pares selecionados divergir mais de 2s do par de referência.
- **Critério de Aceite:** O cliente recebe aviso estruturado em vez de dados silenciosamente desfasados.

### Passo 3.5: Registro Estruturado de Anomalias de Correlação
- **Ação:** Emitir log em JSON quando o skew entre dois ativos monitorados ultrapassar o limite:
  ```json
  { "event": "CROSS_ASSET_SKEW_EXCEEDED", "symbolA": "BTCUSD_OTC", "symbolB": "ETHUSD_OTC", "skew_ms": 3410, "timestamp": "2026-10-06T21:00:00Z" }
  ```
- **Critério de Aceite:** Rastreamento total de dessincronização entre classes de ativos.

### Passo 3.6: Proteção contra Arbitragem de Latência
- **Ação:** Impedir abertura de ordens cruzadas durante o período em que o skew persistir elevado.
- **Critério de Aceite:** Casa protegida matematicamente contra bots de latência.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Par Sincronizado:** Dois ativos com $\text{skew} = 300\text{ms}$ aprovados com sucesso.
2. **Teste de Par Dessincronizado:** Dois ativos com $\text{skew} = 2800\text{ms}$ rejeitados com `CROSS_ASSET_DESYNCHRONIZED`.
3. **Teste de Limite de Borda:** Ativos exatamente em $2000\text{ms}$ e $2001\text{ms}$ validando o limiar exato.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- 100% de precisão na validação de janela temporal cruzada.
- Testes automatizados executados e 100% aprovados.
