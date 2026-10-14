# Subetapa 03 — Blindagem do Frontend: Eliminação do Bug Visual de Reload (F5) e Sincronização de Sessão

**Agente Responsável:** `frontend-realtime-agent`  
**Revisor Visual:** `chief-visual-director` (`designer-senior`)  
**QA & Regressão:** `regression-guardian-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `11-chart-trading-tools`, `21-designer-senior-binmax`  

---

## 1. Objetivo da Subetapa

Eliminar definitivamente qualquer "flicker" ou bug visual onde o saldo pisca ou recarrega em $10.000 durante a atualização da tela (F5) para usuários autenticados, sincronizando o cache local (`binmax_auth_session`), a query do React Query (`['wallet']`) e os seletores de conta no cabeçalho com fidelidade absoluta de design e sem quebras funcionais.

---

## 2. Diagnóstico & O Que Deve Ser Corrigido

1. **Remoção de Fallbacks Hardcoded de $10.000 na UI:**
   - Em `apps/web/src/components/header/AccountSelectorDropdown.tsx`:
     Substituir o fallback `'$10,000.00'` por cálculo baseado no saldo da sessão do usuário se `balanceMinor` ainda estiver pendente:
     ```tsx
     const currentSession = AuthService.getSession();
     const initialDemo = currentSession?.user?.demoBalanceMinor ?? 1000000;
     ```
     Dessa forma, enquanto a requisição de rede viaja, o número exibido permanece exatamente o último saldo conhecido do usuário, sem sobressaltos visuais.
   - Em `apps/web/src/components/header/TerminalHeader.tsx` (linha 932):
     Substituir o fallback fixo `'$10.000,00'` pela formatação do saldo persistido na sessão.
2. **Pré-Hidratação do React Query Cache (`TraderoomShell` / `Dashboard`):**
   - Ao montar o componente `Dashboard` ou `TraderoomShell`, se houver sessão ativa com `session.user.demoBalanceMinor`, inicializar o cache de `['wallet']` no `QueryClient`:
     ```ts
     queryClient.setQueryData(['wallet'], {
       currency: 'USD',
       available_minor: session.user.demoBalanceMinor,
       reserved_minor: 0
     });
     ```
   - Quando o endpoint `/api/v1/wallet` responder, o cache é atualizado suavemente sem nenhum flicker na tela.
3. **Limpeza do Payload de `openContract` (`apps/web/src/api/client.ts`):**
   - Corrigir a chamada para enviar estritamente os campos aceitos pelo schema Zod do backend (`symbol`, `direction`, `stake_minor`, e `duration_seconds` apenas quando diferente de 60s), removendo campos que causavam falhas no vitest (`expiry_mode`, `target_expires_at`).
   - Fazer com que os 9 testes atualmente falhando no vitest passem com 100% de sucesso.
4. **Página de Ajustes (`SettingsPage.tsx`):**
   - Garantir que `AuthService.getProfile()` hidrate todos os inputs (nome, e-mail, país, telefone, saldo demo).
   - Exibir feedback de sucesso ou erro com animação suave e sem desestruturação de layout.

---

## 3. Arquivos Alvo

- `apps/web/src/components/header/AccountSelectorDropdown.tsx`
- `apps/web/src/components/header/TerminalHeader.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/pages/SettingsPage.tsx`

---

## 4. Bateria de Testes Obrigatórios da Subetapa

### 4.1. Testes de Renderização e Estresse Visual
- **Cenário ST-01 (Reload Rápido no Frontend):** Renderização sucessiva do componente `Dashboard` com sessão existente contendo saldo diferente de 10.000 (ex: $12.350,00).
  - *Critério:* O componente inicia imediatamente exibindo `$12,350.00`; em nenhum frame o valor `$10,000.00` é renderizado.
- **Cenário ST-02:** Validação da suíte de testes unitários do vitest:
  - *Comando:* `pnpm test:unit`
  - *Critério:* Todos os 399 testes devem passar com zero falhas (eliminando as 9 falhas atuais).

### 4.2. Testes de Consistência e Regressão
- **Cenário REG-01:** Verificação de que as funcionalidades operacionais existentes (gráficos Lightweight Charts, cotações em tempo real via WebSocket, abas de ativos, abertura de contratos UP/DOWN) permanecem 100% íntegras.
- **Cenário REG-02:** Verificação de que o logout limpa a sessão local e redireciona com segurança.

---

## 5. Critérios de Aceite para Aprovação e Avanço

- [x] Suíte `pnpm test:unit` verde com 100% de aprovação (399+ testes passando).
- [x] O saldo exibido no Traderoom e no dropdown não pisca nem reseta para 10.000 no reload.
- [x] A tela de Ajustes (`/ajustes`) carrega e salva dados sem erros visuais.
- [x] Build do frontend (`pnpm --filter @broker/web build`) compila sem erros de tipagem TypeScript.
