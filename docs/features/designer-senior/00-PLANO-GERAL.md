# Plano Geral — Engenharia de Design Sênior & Motion da BINMAX

> $$\mathbf{\text{“A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO.”}}$$

Este plano operacional governa a implementação integral das diretrizes do **Designer Sênior & Arquiteto de Motion** (`D:\BRENDA\Binmax Options - Broker\frontend\designer sênior.md`) em toda a plataforma BINMAX.

---

## 1. Composição do Squad Especializado

| Papel | Agente / Subagente | Responsabilidade Estrita |
| :--- | :--- | :--- |
| **Liderança Técnica** | `tech-lead-orchestrator` | Condução do fluxo, decomposição das subetapas, validação de gates e integridade arquitetural. |
| **Guardião de Design & Motion** | `designer-senior` (`senior-designer-agent`) | Poder de veto estrito; auditoria das 10 Leis de Design, dos 8 Tokens de Movimento e erradicação dos 12 Anti-patterns de Cassino. |
| **Implementação Cirúrgica** | `surgical-frontend-agent` (`cirurgiao`) | Escrita de código com menor diff possível em `apps/web/src/**`, respeitando o padrão de superfícies e sem quebrar rotas. |
| **QA, Estresse e Caos** | `qa-resilience-agent` | Criação de baterias de testes unitários, testes de estresse de render a 60 FPS, simulação de caos de latência e resiliência visual. |
| **Conformidade & Risco** | `compliance-risk-reviewer` | Verificação de integridade de saldo Blnk, preservação de `minor_units`, ausência de manipulações no cliente e clareza de saque. |
| **Guardião de Regressão** | `regression-guardian-agent` | Execução contínua da suíte Vitest, checagem de tipos TypeScript e garantia de não-regressão. |

### Skills Ativadas
- `01-project-context`
- `11-chart-trading-tools`
- `12-tokens-binmax`
- `13-textos-es`
- `15-chave-sala-nova`
- `17-mudanca-cirurgica`
- `18-zonas-sensiveis`
- `19-testes-de-regressao-visual`
- `20-conduzir-etapa`
- `21-designer-senior-binmax`

---

## 2. Mapa das 6 Subetapas

```text
[Subetapa 01] Sistema de Tokens de Precisão & Física de Movimento (CSS & Variáveis)
      │
      ▼
[Subetapa 02] Verificação de Conta (Hierarquia Narrativa, Dropzone Protagonista, 5 Estados)
      │
      ▼
[Subetapa 03] Autenticação e Confiança (Login, Recuperação, Erro sem Shake, Entradas em Bloco)
      │
      ▼
[Subetapa 04] Gestão Financeira Sem Atrito (Depósito e Saque PIX Transparente, Modais Escalares)
      │
      ▼
[Subetapa 05] Sala de Trading & Instrumentação (Latência Honesta, Zero Spinners, Som Opt-in, Toasts)
      │
      ▼
[Subetapa 06] Certificação Final Integrada, Testes de Caos, Estresse e Homologação
```

### Detalhamento das Subetapas:

1. **Subetapa 01: Sistema de Tokens de Precisão & Física de Movimento**
   - Criação e consolidação dos tokens CSS `--bm-ease`, `--bm-t-micro`, `--bm-t-base`, `--bm-t-enter`, `--bm-t-count`, `--bm-dist-max`.
   - Sistema de 3 superfícies tonais (`#0B0E14`, `#121721`, `#1A202C`).
   - Eliminação de classes de bounce, shake e neons decorativos.
   - Documento: `docs/features/designer-senior/subetapa-01-tokens-e-fisica-de-movimento.md`.

2. **Subetapa 02: Página de Verificação de Conta (`VerificationPage.tsx`)**
   - Aplicação da Hierarquia Narrativa: Dropzone protagonista, lista coadjuvante, notas secundárias.
   - Substituição de emojis por ícones vetoriais uniformes de precisão.
   - Estados: Vazio, Carregando com progresso real em bytes, Cheio, Erro sem tremor e Sucesso.
   - Documento: `docs/features/designer-senior/subetapa-02-verificacao-de-conta.md`.

3. **Subetapa 03: Página de Login e Recuperação de Acesso (`LoginPage.tsx`, `PasswordRecoveryPage.tsx`)**
   - Ambiente de sobriedade bancária suíça (baixa densidade, respiração).
   - Headline alinhada: *"A Binmax é a plataforma onde o gráfico obedece ao seu clique, não ao algoritmo da casa."*
   - Erro em campo com fade 180ms + borda vermelha 100ms (**zero shake**).
   - Entradas de página em bloco único (260ms).
   - Documento: `docs/features/designer-senior/subetapa-03-login-e-autenticacao.md`.

4. **Subetapa 04: Gestão Financeira sem Atrito (`DepositPage.tsx`, `WithdrawPage.tsx`, Modais)**
   - Saque PIX direto e status transparente.
   - Modais escalando sutilmente de 0.98 para 1.0 em 180ms com backdrop de 60%.
   - Valores exclusivamente em Geist Mono com `tabular-nums`.
   - Documento: `docs/features/designer-senior/subetapa-04-deposito-e-saque.md`.

5. **Subetapa 05: Sala de Trading & Instrumentação Cirúrgica (`App.tsx`, `OrderTicket.tsx`, `TradeResultToast.tsx`)**
   - Som desligado por padrão (`soundEnabled = false`); feedback opcional com clique seco de 50ms.
   - Ordem SUBE/BAJA com feedback físico local imediato (0ms) e **ZERO SPINNERS** mascarando rede.
   - Toast de liquidação sóbrio (duração 4s, entrada 260ms, saída 180ms).
   - Desconexão com perda de saturação para 40% e pílula discreta de reconexão.
   - Documento: `docs/features/designer-senior/subetapa-05-sala-de-trading.md`.

6. **Subetapa 06: Bateria de Certificação, Estresse, Caos e Auditoria Visual**
   - Suíte Vitest cobrindo 100% dos novos comportamentos e componentes.
   - Teste de caos anti-cassino (garantia de zero confetes, moedas, sons estridentes e bounce).
   - Parecer oficial de aprovação emitido pelo `designer-senior`.
   - Documento: `docs/features/designer-senior/subetapa-06-certificacao-e-caos.md`.

---

## 3. Regra de Execução Estrita
**Nenhuma subetapa é iniciada antes de a anterior estar 100% implementada, testada e validada com suite Vitest verde.**
