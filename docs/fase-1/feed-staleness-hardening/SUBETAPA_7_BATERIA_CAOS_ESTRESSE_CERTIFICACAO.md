# Subetapa 7: Bateria de Caos, Estresse & Certificação Final

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `qa-resilience-agent`  
**Agente Revisor Geral:** `broker-architect-agent`  
**Agente Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes Protegidas:** V-01 a V-13 (Protocolo completo de certificação)

---

## 1. Escopo e Objetivos da Subetapa
Executar a bateria definitiva de caos e estresse contra os 7 métodos implementados para comprovar matematicamente que o perigo de "feed stale parecendo vivo" foi erradicado com 100% de eficácia em condições extremas de concorrência, morte de processos, perda de pacotes e corte de link TCP. A certificação final é homologada de forma estrita pelo `post-implementation-verifier`.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 7.1: Bateria de Caos C-02 (Injeção de Silêncio Seletivo em Multi-Gráficos)
- **Ação:** Em um cluster rodando 36 ativos com clientes conectados em grade 2x2, cortar o envio de ticks de 1 par específico (`BTCUSD_OTC`).
- **Critério de Aceite:**
  * O gráfico de `BTCUSD_OTC` exibe o banner de alerta em exatamente 4 segundos.
  * A boleta de negociação para `BTCUSD_OTC` é travada.
  * Os outros 35 pares continuam operando normalmente sem falso alarme e sem interrupção.

### Passo 7.2: Bateria de Caos C-03 (Morte Súbita de WebSocket Gateway)
- **Ação:** Enviar `kill -9` no processo do gateway durante negociação ativa.
- **Critério de Aceite:**
  * O heartbeat detecta a quebra.
  * O cliente aciona o backoff e restabelece a conexão em $< 3\text{ s}$.
  * Zero saldo demo duplicado ou ordens fantasmas.

### Passo 7.3: Bateria de Estresse E-05 (Spam de Ordens durante Estado Stale)
- **Ação:** Durante o congelamento do feed de um ativo, disparar 1.000 requisições concorrentes de `POST /contracts` com 50 VUs (Virtual Users).
- **Critério de Aceite:**
  * 1.000 de 1.000 requisições rejeitadas com HTTP 409 `FEED_STALE`.
  * Taxa de erro aceita na regra de negócio = 100% (nenhuma passa).
  * Saldo conservado com zero divergência no Ledger.

### Passo 7.4: Bateria de Caos C-04 (Injeção de Gaps Numéricos Massivos)
- **Ação:** Injetar saltos artificiais de sequência (ex: seq 100 $\to$ seq 115) para múltiplos clientes.
- **Critério de Aceite:**
  * 100% dos clientes detectam o gap, buscam o snapshot atômico e sincronizam o gráfico sem duplicar velas.

### Passo 7.5: Auditoria Contábil de Tolerância Zero Anti-Cross & Payout
- **Ação:** Executar query SQL pós-teste para garantir que nenhum contrato utilizou preço cruzado ou tick vencido.
- **Critério de Aceite:** 0 divergências na tabela `contracts` e no Blnk Ledger.

### Passo 7.6: Relatório Formal do Post-Implementation Verifier
- **Ação:** Execução do protocolo formal de verificação pós-implementação comprovando o cumprimento de todas as garantias de V-01 a V-13.
- **Critério de Aceite:** Veredito final **APROVADO** emitido pelo verificador em modo read-only estrito.

---

## 3. Critérios Formais de Homologação Final
1. 100% dos cenários de teste de caos C-02, C-03, C-04 e E-05 aprovados.
2. Certificação formal assinada pelo `post-implementation-verifier` e `broker-architect-agent`.
