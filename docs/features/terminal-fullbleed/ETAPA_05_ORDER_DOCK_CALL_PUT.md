# Subetapa 5: Coluna Operacional de Ordens (CALL / PUT)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Revisão Financeira:** `financial-correctness-reviewer`  
**Auditoria de Segurança:** `security-reviewer`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 5 APROVADO)  

---

## 1. Objetivo da Etapa
Construir a **Coluna Operacional de Ordens Direita** (`300px` fixos), projetada para execução de ordens em milissegundos no estilo IQ Option / Quadcode:
- Seletor de Tempo de Expiração com contagem regressiva ao vivo sincronizada com a vela.
- Campo de Stake com **Steppers `[-]` e `[+]`** e **Presets Rápidos** (ex: `$1`, `$5`, `$10`, `$25`, `$50`, `$100`).
- Badge dinâmico de **Rendimento / Lucro Potencial** (`+85%` ou `+US$ 8,50`).
- Botões de Alta Pressão Operacional:
  - **▲ ACIMA (CALL)**: Verde néon fluorescente (`#00e676`), ícone de subida e lucro estimado.
  - **▼ ABAIXO (PUT)**: Vermelho carmim (`#ff3d71`), ícone de descida e lucro estimado.
- **Trava de Segurança dos Últimos 30 Segundos**:
  - Quando a vela entra nos 30s finais de expiração, a compra é congelada com indicação clara para aguardar o início da próxima vela.
- **Idempotência Absoluta e Prevenção de Double-Click**:
  - Geração de `crypto.randomUUID()` pré-envio e estado de busy imediato.

---

## 2. Especificação de Componentes

### Componente `OrderDock.tsx`
- Layout vertical espaçado com cartões escuros de alta densidade (`#0e1626`).
- **Seletor de Tempo**: Mostra o relógio UTC corrente e tempo restante para expiração da ordem.
- **Card de Investimento (Stake)**:
  - Input com formato `US$ 10,00`.
  - Botões laterais `-` e `+` (incrementos de $1,00 ou $5,00).
  - Pílulas de acesso rápido com valores fixos para facilitar a operação rápida.
- **Card de Retorno**:
  - Exibe com clareza: Rentabilidade `+85%` | Retorno Total: `$18,50` | Lucro Líquido: `+$8,50`.
- **Botões ACIMA / ABAIXO**:
  - Altura imponente (64px cada), fontes em negrito de alto contraste, feedback sonoro suave (opcional via Web Audio API) e animação de clique instantâneo.

---

## 3. Matriz de Testes & Validação da Etapa 5

### A. Teste de Estresse (Cliques Frequentes & Race Conditions)
- Submeter 20 cliques rápidos nos botões ACIMA e ABAIXO:
  - Apenas 1 ordem deve ser despachada por ciclo de confirmação.
  - O estado do botão deve travar imediatamente com spinner sem travar o restante da UI.

### B. Teste de Integridade Financeira (I-01, I-02, D-18)
- Validar se o stake é convertido rigorosamente para centavos inteiros (`100` a `10000`).
- Nenhuma operação aceita valores negativos, zero ou frações fracionárias flutuantes (ex: `10.555`).

### C. Teste de Segurança (Manipulação de DOM & DevTools)
- Tentar alterar o valor de retorno ou payout no DOM do cliente:
  - O servidor e o backend permanecem como a única fonte de verdade; o front apenas reflete dados autoritativos.

---

## 4. Critérios de Passagem (Quality Gate 5)
- [ ] Coluna de ordens fixada com precisão na lateral direita (300px).
- [ ] Steppers `[-]` e `[+]` e presets de valor funcionando com validação em centavos.
- [ ] Botões ACIMA e ABAIXO disparam ordens com `Idempotency-Key` e desativação imediata.
- [ ] Trava visual ativa nos últimos 30 segundos de cada ciclo.
