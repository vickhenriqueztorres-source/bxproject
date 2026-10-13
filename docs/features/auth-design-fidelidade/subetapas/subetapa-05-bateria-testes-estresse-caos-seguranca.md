# Subetapa 05 — Bateria Integrada de Testes de Estresse, Caos, Segurança e UX

> **Objetivo:** Submeter as telas de Login e Registro refatoradas a testes rigorosos e automatizados com Vitest, simulando sobrecarga de SSR, rajadas de submissões simultâneas, quedas e atrasos na rede, injeções maliciosas (XSS/SQL) e confirmação visual de ausência de anti-patterns de cassino.

---

## 1. Escopo de Arquivos

### Arquivos Criados / Executados:
- `apps/web/src/pages/auth-precision-stress-chaos.unit.test.tsx` (Testes unificados de estresse, caos, segurança e auditoria visual)
- Execução conjunta de toda a suíte de testes de autenticação:
  - `apps/web/src/pages/auth-pages.unit.test.tsx`
  - `apps/web/src/pages/auth-precision-stress.unit.test.tsx`
  - `apps/web/src/pages/auth-full-lifecycle-e2e.unit.test.tsx`
  - `apps/web/src/pages/auth-precision-stress-chaos.unit.test.tsx`

---

## 2. Matriz de Baterias de Testes

### 2.1 Bateria de Estresse:
1. **100 ciclos de renderização SSR da nova LoginPage**:
   - Medição de tempo de render síncrono.
   - Limite estrito: < 600ms para 100 ciclos completos.
2. **100 ciclos de renderização SSR da nova RegisterPage**:
   - Limite estrito: < 600ms para 100 ciclos completos.
3. **50 alternâncias consecutivas de aba em loop**:
   - Medição de render e disparo de callbacks.

### 2.2 Bateria de Caos e Resiliência de Rede:
1. **Timeout e Erro de Conexão na API de Login**:
   - Simulação de rejeição de promise (`Network Error` / `Gateway Timeout`).
   - Verificação de exibição da mensagem de erro amigável sem quebrar o estado da aplicação nem congelar a tela.
2. **Falha na Criação de Carteira Demo**:
   - Rejeição na chamada de registro com recuperação limpa e possibilidade de retry imediato.

### 2.3 Bateria de Segurança:
1. **Proteção Anti-Brute Force**:
   - Confirmação de que após 5 senhas incorretas a tela exibe o estado bloqueado e impede chamadas ao backend.
2. **Sanitização de Payloads e Injeção**:
   - Envio de tags HTML e strings maliciosas (`<script>`, SQL injection, caracteres unicode complexos) garantindo que nenhum script seja executado e os campos mantenham a integridade.
3. **Ausência de Credenciais Vazadas**:
   - Inspeção da árvore DOM para confirmar que nenhum campo expõe dados em atributos `data-*` desnecessários.

### 2.4 Bateria de Anti-Cassino e Fidelidade Visual:
1. **Zero Animações Proibidas**:
   - Ausência de classes de `shake`, `@keyframes shake`, `bounce`, efeitos de confete ou moedas caindo.
2. **Conformidade de Tokens Cromáticos**:
   - Superfícies `#0B0E14`, `#101622`, `#151D2B`, `#1C2738` e verde `#22C47A`.
3. **Números Tabulares em Geist Mono**:
   - Validação da classe `bm-tabular-nums` na latência (`16ms`) e valores financeiros.

---

## 3. Critérios de Aceite
- 100% dos testes de estresse, caos e segurança passando com sucesso no Vitest.
