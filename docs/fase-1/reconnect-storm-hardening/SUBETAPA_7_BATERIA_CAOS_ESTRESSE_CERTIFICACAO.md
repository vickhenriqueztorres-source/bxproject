# Subetapa 7: Bateria de Caos, Carga & Certificação Final de Reconnect Storm

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de QA:** `qa-resilience-agent`  
**Agente Revisor Geral:** `broker-architect-agent`  
**Agente Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-01 a V-13 (Protocolo de Garantias Pós-Implementação)

---

## 1. Escopo e Objetivos da Subetapa
Submeter todo o sistema à bateria de caos mais hostil do setor: queda simultânea de todos os 36 feeds de ativos, upstream morto permanentemente gerando recusas 503/429, tempestade de 1.000 reconexões simultâneas e reinício em massa de 100 abas no deploy. Provar formalmente que as 4 técnicas combinadas eliminam o Reconnect Storm e preservam a estabilidade do sistema e as garantias V-01 a V-13.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 7.1: Bateria de Caos C-08 (Queda Simultânea de 36 Feeds de Ativos)
- **Ação:** Desconectar abruptamente todos os 36 feeds em $t=0$.
- **Critério de Aceite:**
  * Zero picos concentrados de reconexão: as tentativas de reconexão são amortecidas e distribuídas pelo Full Jitter e Token Bucket.
  * O throughput de reconexão respeita o teto de 10/s.

### Passo 7.2: Bateria de Caos C-09 (Upstream Permanentemente Inoperante)
- **Ação:** Simular upstream retornando `ECONNREFUSED` contínuo.
- **Critério de Aceite:**
  * O Circuit Breaker abre no 3º erro consecutivo.
  * Todas as tentativas cessam pelos 30 segundos de cooldown.
  * Zero exaustão de CPU ou socket leak.

### Passo 7.3: Bateria de Caos C-10 (Avalanche de 1.000 Clientes Concorrentes)
- **Ação:** Disparar 1.000 instâncias de reconexão concorrentes simultâneas.
- **Critério de Aceite:**
  * O Token Bucket limita o fluxo estritamente a 10 requisições/s.
  * Zero erro de handshake `429` do gateway.

### Passo 7.4: Bateria de Estresse E-07 (Deploy Restart Simultâneo de 100 Abas)
- **Ação:** Simular o reinício de 100 abas de navegadores com Staggered Startup.
- **Critério de Aceite:**
  * Conexões distribuídas suavemente ao longo de 10 segundos ($\text{média} \le 10/\text{s}$).
  * Zero picos no instante 0.

### Passo 7.5: Auditoria Contábil e Anti-Cross (V-01 a V-13)
- **Ação:** Confirmar que durante as tempestades e reconexões, nenhum contrato foi liquidado com preço fantasma ou teve saldo corrompido no Ledger Blnk.
- **Critério de Aceite:** Equação de soma zero e garantias V-01 a V-13 100% verificadas.

### Passo 7.6: Certificação Formal Independente
- **Ação:** Executar a bateria completa e emitir parecer assinado pelos agentes.
- **Critério de Aceite:** Parecer formal aprovado sem pendências.
