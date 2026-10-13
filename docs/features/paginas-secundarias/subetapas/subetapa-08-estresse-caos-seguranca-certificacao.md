# Subetapa 08: Bateria Integrada de Testes de Estresse, Caos, Segurança & Certificação Final

**Responsáveis:** `qa-resilience-agent`, `financial-correctness-reviewer`, `security-reviewer`, `regression-guardian-agent`, `tech-lead-orchestrator`

---

## 1. Objetivo Técnico
Executar o protocolo formal de certificação industrial para todo o ecossistema de páginas secundárias e sala de trading da BINMAX, submetendo os componentes e APIs a cenários adversos de rede, concorrência agressiva, injeção de falhas e auditoria visual 100% verde antes da liberação final.

---

## 2. Matriz de Baterias de Testes

### 2.1 Testes de Carga e Estresse
1. **Concorrência de Cliques e Submissões:**
   - 100 ciclos ultra-rápidos de alternância de rotas SPA no front sem memory leaks de timers ou event listeners.
   - 50 tentativas de submissão de formulário (login/registro/depósito) em menos de 100ms para certificar blindagem anti-duplo clique.
2. **Estresse do Live Chart e Feed:**
   - Injeção de 1.000 ticks/segundo no mini-gráfico mudo e no live preview sem travamento da interface (estabilidade em 60 FPS).

### 2.2 Testes de Caos e Resiliência
1. **Perda Repentina de Conexão WebSocket:**
   - Transição automática da sala ou mini-gráfico para o estado "Reconectando...", com congelamento do último tick e desabilitação dos botões de ação.
   - Auto-recuperação transparente assim que o WebSocket reconectar, sem necessidade de recarregar a página (`F5`).
2. **Falha Transitória de API (HTTP 500 / 503 / Timeout):**
   - O modal de depósito transiciona confiavelmente para o estado "No pudimos procesar tu pago" permitindo retry ou mudança de método sem corrupção de estado.

### 2.3 Testes de Segurança (OWASP & Invariantes)
1. **Proteção Anti-Brute Force:**
   - Bloqueio comprovado de IP/usuário após 5 senhas incorretas consecutivas com exibição da tela de bloqueio temporário.
2. **Proteção Anti-XSS e Injeção:**
   - Injeção de tags `<script>` e payloads SVG em campos de Nome, Email, Chave PIX e Comprovantes KYC para provar que são escapados e sanitizados.
3. **Auditoria de Zonas Sensíveis:**
   - Comando `git diff --name-only | grep -F -f docs/zonas-sensiveis.txt` estritamente limpo e validado.
   - Nenhuma violação das invariantes financeiras I-01 a I-06.

### 2.4 Certificação de Fidelidade Visual 1:1
- Comparação das 18 imagens de referência com as páginas renderizadas.
- Verificação de tokens hex (`#0B1220`, `#111A2B`, `#1F2A3A`, `#E6EDF5`, `#8A96A8`, `#22C55E`, `#EF4444`).
- Verificação das fontes `Archivo` e `Geist Mono` (`tabular-nums`).
- Verificação do raio de curvatura de borda (`border-radius: 6px`).
- Totalidade dos 456 testes anteriores + novos testes passando 100%.
