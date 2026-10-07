# Subetapa 7: Bateria de Caos, Carga & Certificação Final de Sincronismo

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de QA:** `qa-resilience-agent`  
**Agente Revisor Geral:** `broker-architect-agent`  
**Agente Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-01 a V-13 (Protocolo de Garantias Pós-Implementação)

---

## 1. Escopo e Objetivos da Subetapa
Submeter todo o sistema a condições hostis de rede: atraso assimétrico entre rotas de ativos, pacotes fora de ordem, salto artificial de relógio (NTP drift) e carga concorrente maciça sobre os 36 ativos, comprovando matematicamente que o perigo de "Dessincronização entre ativos / Latency Tax" foi completamente neutralizado.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 7.1: Bateria de Caos C-05 (Atraso Assimétrico em Multi-Gráficos)
- **Ação:** Em uma grade multi-gráficos, atrasar intencionalmente os ticks do par `ETHUSD_OTC` em 3.5 segundos enquanto `BTCUSD_OTC` segue a 1Hz.
- **Critério de Aceite:**
  * O validador cross-asset detecta o skew e bloqueia qualquer operação conjunta.
  * A UI alerta dessincronização visual em $< 500\text{ms}$.
  * Zero falsos trades baseados em arbitragem de spread defasado.

### Passo 7.2: Bateria de Caos C-06 (Injeção de Pacotes Fora de Ordem e Late Data)
- **Ação:** Injetar pacotes com timestamps anteriores à linha d'água (watermark).
- **Critério de Aceite:**
  * 100% dos pacotes tardios são rotulados como `LATE_DATA` e descartados do preço de mercado ativo.
  * O watermark avança de forma monotônica inabalável.

### Passo 7.3: Bateria de Caos C-07 (Simulação de Salto de Relógio / Clock Jump)
- **Ação:** Simular avanço abrupto do relógio do servidor em 150ms.
- **Critério de Aceite:**
  * O monitor de NTP detecta o drift em tempo hábil.
  * Alertas disparam sem que a medição de latência gere valores corrompidos.

### Passo 7.4: Bateria de Estresse E-06 (Avalanche de 36 Feeds com Jitter Randômico)
- **Ação:** Disparar 36 streams simultâneos com jitter gaussiano de rede ($\sigma = 200\text{ms}$) para 100 conexões de clientes.
- **Critério de Aceite:**
  * Zero travamento ou vazamento de memória.
  * Skew médio entre pares mantido em $< 500\text{ms}$.

### Passo 7.5: Auditoria de Pós-Condições Financeiras e Anti-Cross
- **Ação:** Validar que nenhum contrato liquidado sofreu interferência de preço cruzado e que o Ledger Blnk permaneceu intacto.
- **Critério de Aceite:** Soma zero no ledger inviolada e 0 anomalias contábeis.

### Passo 7.6: Certificação Formal Independente
- **Ação:** Execução de todas as suítes de teste de integração, regressão e verificação formal.
- **Critério de Aceite:** Relatório de certificação assinado por todos os agentes envolvidos.

---

## 3. Critérios Formais de Homologação Final
1. 100% dos cenários de teste de caos C-05, C-06, C-07 e E-06 aprovados.
2. Certificação formal aprovada pelo `post-implementation-verifier`.
