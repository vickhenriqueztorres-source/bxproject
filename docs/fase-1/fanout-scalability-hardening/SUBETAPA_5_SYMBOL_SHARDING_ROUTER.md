# Subetapa 5: Sharding por Símbolo (Escala Horizontal Multi-Nó)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent` & `broker-architect-agent`  
**Agente Revisor:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `07-production-operations`  
**Invariantes:** Escala Horizontal | Balanceamento Homogêneo de Carga

---

## 1. Escopo e Objetivos da Subetapa
Distribuir os canais Pub/Sub dos 36 ativos entre múltiplos nós de Redis através de particionamento consistente:
$$\text{nodeIndex} = \text{hash}(\text{symbol}) \pmod{\text{numNodes}}$$
- Evita que um único nó Redis concentre todo o volume de mensageria da plataforma.
- Garante roteamento determinístico: o canal de um determinado ativo sempre trafega pelo mesmo nó responsável.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 5.1: Modelagem do `SymbolShardingRouter`
- **Ação:** Criar o módulo `SymbolShardingRouter` com função de hash não-criptográfica ultrarrápida (ex: FNV-1a ou DJB2) para mapear símbolos para índices de nós.
- **Critério de Aceite:** O mapeamento é estritamente determinístico ($\text{hash}(s) \pmod{N}$ sempre retorna o mesmo nó para a mesma string).

### Passo 5.2: Suporte a Pool Multi-Conexão no Gateway e Relay
- **Ação:** Configurar o router para gerenciar conexões ou pools para cada shard configurado (ex: nós 0, 1, 2).
- **Critério de Aceite:** O gateway assina o canal no nó específico correspondente ao ativo.

### Passo 5.3: Teste de Homogeneidade Estatística dos 36 Ativos
- **Ação:** Mapear os 36 ativos do catálogo oficial entre 3 nós virtuais ($N=3$).
- **Critério de Aceite:**
  * Cada nó recebe entre 10 e 14 ativos (distribuição equilibrada $\approx 12$ por nó).
  * Nenhum nó fica ocioso (0 ativos) ou sobrecarregado (> 16 ativos).

### Passo 5.4: Teste de Roteamento Determinístico Repetido
- **Ação:** Executar 10.000 iterações de consulta de nó para `BTCUSD_OTC`, `ETHUSD_OTC` e `EURUSD_OTC`.
- **Critério de Aceite:** 100% das consultas retornam o mesmo nó designado, garantindo consistência sem desvios.

### Passo 5.5: Suporte a Modo Single-Node Fallback
- **Ação:** Assegurar que se apenas 1 nó Redis estiver configurado (`numNodes = 1`), o router opera perfeitamente retornando o nó 0 sem degradação ou complexidade desnecessária.
- **Critério de Aceite:** Compatibilidade transparente com ambiente de desenvolvimento local.

### Passo 5.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-5-symbol-sharding.mjs`.
- **Critério de Aceite:** 100% de aprovação comprovando balanceamento homogêneo.
