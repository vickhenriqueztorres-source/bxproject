# Subetapa 4: Ponto de Entrada da Ordem com Bandeirinha (Strike Line & Flag)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Auditoria Financeira:** `financial-correctness-reviewer`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 4 APROVADO)  

---

## 1. Objetivo da Etapa
Assim que uma ordem é enviada e confirmada (ACIMA ou ABAIXO), desenhar diretamente no gráfico:
1. **Linha Horizontal de Entrada (Strike Price Line)**:
   - Traçada na cotação exata de entrada do contrato.
   - Cor verde (`#00e676`) para ordens CALL (ACIMA) e vermelha (`#ff3d71`) para PUT (ABAIXO).
2. **Bandeirinha Flutuante (Order Flag)**:
   - Fixada na linha horizontal de preço, acompanhando a evolução da operação.
   - Exibe a direção (▲ ou ▼), valor investido (ex: `$10,00`) e tempo restante.
   - Ponto de conexão visual que liga o preço de abertura ao preço de mercado atual.

---

## 2. Especificação Técnica
- Adição da linha de preço via `series.createPriceLine({ price, color, lineStyle, axisLabelVisible, title })`.
- Bandeirinha de overlay estilizada renderizada na posição $Y$ correspondente ao preço da ordem.
- Remoção ou transição suave da linha quando a ordem for liquidada (status `SETTLED`).

---

## 3. Matriz de Testes & Validação da Etapa 4

### A. Teste de Precisão Financeira
- O valor da linha de strike deve corresponder com exatidão matemática ao preço retornado no comprovante de abertura (`openContract`).
- Nenhuma discrepância de arredondamento ou escala.

### B. Teste de Caos (Múltiplas Ordens Simultâneas)
- Abrir 3 ordens em preços e tempos diferentes:
  - Cada uma deve exibir sua própria linha de strike e bandeirinha correspondente sem sobreposição destrutiva.

---

## 4. Critérios de Passagem (Quality Gate 4)
- [ ] Linha de entrada e bandeirinha aparecem imediatamente ao abrir contrato.
- [ ] Cores diferenciadas (Verde para CALL, Vermelho para PUT).
- [ ] Remoção automática e transição ao liquidar a ordem.
