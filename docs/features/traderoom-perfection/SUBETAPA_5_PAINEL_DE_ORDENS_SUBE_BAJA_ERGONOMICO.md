# SUBETAPA 5: PAINEL DE ORDENS SUBE / BAJA ERGONÔMICO (TICKET LATERAL)

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `iq-fidelity-reviewer`, `compliance-risk-reviewer`, `financial-correctness-reviewer`, `surgical-frontend-agent`  
> **Skills Aplicadas:** `02-financial-invariants`, `12-tokens-binmax`, `13-textos-es`, `14-teste-de-sobreposicao`, `17-mudanca-cirurgica`, `18-zonas-sensiveis`

---

## 1. Objetivo Visual e Funcional
Substituir o painel de ordens rústico e verticalmente desalinhado pelo **Order Ticket ergonômico e cirúrgico** exibido na **Imagem 1** e **Imagem 2**:

1. **Estrutura Compacta e Elegante (Largura ~120px a ~140px):**
   - **Bloco 1: Monto (Investimento):**
     - Cabeçalho: `Monto` com ícone discreto de ajuda `(?)`.
     - Campo de valor: Botão `−` à esquerda, valor `$ 100` ao centro (Geist Mono tabular), botão `+` à direita.
   - **Bloco 2: Expiración (Tempo de Vencimento):**
     - Cabeçalho: `Expiración` com ícone de ajuda `(?)`.
     - Campo de tempo: Botão `−` à esquerda, ícone de relógio e contagem `00:21` ao centro, botão `+` à direita.
   - **Bloco 3: Ganancia (Rendimento):**
     - Cabeçalho: `Ganancia` com ícone de ajuda `(?)`.
     - Valor percentual gigante: `+85%` em verde neon (`#22C47A`).
     - Valor monetário em dólar: `+$85.00` em verde vivo.
   - **Bloco 4: Botões de Operação Gigantes (SUBE / BAJA):**
     - **Botão SUBE:** Fundo verde `#22C47A`, cantos arredondados, ícone vetorial de linha gráfica subindo com seta para o topo nordeste, texto em caixa alta `SUBE`.
     - **Botão BAJA:** Fundo vermelho `#F2545B`, cantos arredondados, ícone vetorial de linha gráfica descendo com seta para a base sudeste, texto em caixa alta `BAJA`.
2. **Proteções de Integridade & Concorrência:**
   - Prevenção rigorosa de duplo clique (*Double Click Protection*): desabilita o botão imediatamente após o primeiro disparo até o recebimento do receipt.
   - Chave de idempotência única UUIDv4 gerada por clique.
   - Preservação dos efeitos sonoros institucionais (som de abertura, clique e apito de ganho/perda).

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/trade/OrderTicket.tsx` (Reestruturação da árvore de componentes do ticket de ordem).
- `apps/web/src/styles.css` (Regras de layout para `.theme-binmax .binmax-order-dock` e botões SUBE/BAJA).
- `apps/web/src/trade/ticket-ergonomic.unit.test.ts` (Testes unitários e de concorrência do ticket).

### 2.2 O que Muda
- O layout dos botões SUBE e BAJA adquire a dimensão retangular generosa e os ícones gráficos da Imagem 1.
- O campo de Monto e Expiración ganha o alinhamento horizontal com `−` e `+` nas extremidades.
- O bloco de Ganancia assume a hierarquia tipográfica com `+85%` em destaque.

### 2.3 O que NÃO Muda (Invariantes Financeiros)
- O cálculo do valor enviado ao servidor é estritamente em centavos inteiros (`stakeMinor`).
- O payload de submissão para `openContract` permanece idêntico: `{ symbol, direction, stake_minor, idempotency_key, duration_seconds, target_expires_at, mode }`.
- O saldo do usuário nunca é deduzido localmente por inferência antes da confirmação do evento de liquidação/carteira.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Renderização dos blocos `Monto`, `Expiración`, `Ganancia`, `SUBE` e `BAJA`.
- Incremento e decremento de Monto via botões `+` e `−` respeitando piso de $1 e teto de $10.000.
- Cálculo correto do retorno projetado (+85% de $100 = +$85.00).

### 3.2 Testes de Estresse & Concorrência
- **Clique Rápido Repetido:** 10 cliques rápidos no botão `SUBE` em menos de 200ms resultam em exatamente **1 única requisição** disparada com 1 Idempotency Key.
- Resposta sob latência de 2000ms: botão permanece em estado de carregamento sem permitir disparo concorrente.

### 3.3 Testes de Caos
- Saldo menor que o valor do investimento: os botões SUBE e BAJA são desabilitados com tooltip explicativo sem disparar requisição inválida para o backend.
- Feed congelado (`stale = true`): bloqueio preventivo de abertura de novos contratos para proteger o capital do usuário.

### 3.4 Testes de Segurança
- Validação de que o usuário não consegue injetar strings maliciosas ou valores negativos no input de Monto via inspector.

### 3.5 Testes de Regressão
- Se a feature flag for desligada (`NEW_TRADEROOM = false`), o ticket clássico continua operando sem erros.

---

## 4. Critérios de Aceite (Gate de Saída)
1. Ticket lateral com estética idêntica à Imagem 1.
2. Botões SUBE e BAJA com ícones gráficos de tendência e resposta tátil imediata.
3. Prevenção de duplo clique 100% comprovada por teste automatizado.
4. `ticket-ergonomic.unit.test.ts` 100% verde.
