# Subetapa 7: Bateria de Estresse, Caos, Segurança e Certificação Final

**Orquestrador:** `tech-lead-orchestrator`  
**QA & Caos:** `qa-resilience-agent`  
**Segurança:** `security-reviewer`  
**Revisão Financeira:** `financial-correctness-reviewer`  
**Arquiteto Chefe:** `broker-architect-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 7 APROVADO)  

---

## 1. Objetivo da Etapa
Executar a validação de ponta a ponta do Terminal Full-Bleed sob condições adversas extremas:
1. **Carga e Estresse de Renderização (Stress Test)**: Injeção contínua de 50 a 100 ticks/segundo no canvas.
2. **Caos de Conectividade (Chaos Engineering)**: Simulação de perda repentina de pacotes WebSocket, desconexões e reconexão por `lastSequence`.
3. **Auditoria Forense de Segurança (Security Assessment)**: Verificação de vetores de injeção, headers HTTP de contenção, integridade de tokens e CSRF/Clickjacking.
4. **Verificação de Invariantes Financeiras (Financial Sanity)**: Balanço de soma zero, consistência em centavos USD (`*_minor`) e assertividade de liquidação.

---

## 2. Cenários de Teste

### Cenário 1: Tsunami de Ticks (50 ticks/s)
- **Procedimento:** Gerar 3.000 ticks em 60 segundos com variação browniana.
- **Métricas Alvo:**
  - Framerate mantido acima de 55 FPS.
  - Consumo de memória JS heap estável (sem vazamentos detectados).
  - Nenhuma perda de sequência no gráfico.

### Cenário 2: Caos de Desconexão (20s Blackout)
- **Procedimento:** Derrubar o socket TCP por 20 segundos enquanto ordens estão ativas e restabelecer.
- **Resultado Esperado:** O terminal detecta a queda em até 3s, exibe indicador de reconexão sutil, restabelece o canal, solicita o catch-up por `lastSequence` e liquida qualquer ordem que expirou durante o apagão com base no tick oficial.

### Cenário 3: Validação em Diferentes Resoluções
- **Procedimento:** Testar em telas ultrawide (3440x1440), Full HD (1920x1080), laptops compactos (1366x768) e tablets (1024x768).
- **Resultado Esperado:** Terminal sem quebras, sem barras de rolagem globais e 100% dos controles operacionais visíveis e clicáveis.

---

## 3. Critérios de Certificação Final (Quality Gate 7)
- [ ] Todos os 7 Quality Gates validados.
- [ ] Zero regressões nos testes do monorepo (`pnpm test` e `pnpm build`).
- [ ] Documentação e manual de uso do terminal arquivados.
- [ ] Assinatura dos 5 agentes revisores no relatório de conformidade.
