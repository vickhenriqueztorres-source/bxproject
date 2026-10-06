# Subetapa 2: Topbar Header, Multi-Asset Tabs & Wallet Switcher

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**QA & Caos:** `qa-resilience-agent`  
**Revisão Financeira:** `financial-correctness-reviewer`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 2 APROVADO)  

---

## 1. Objetivo da Etapa
Construir o cabeçalho superior ultra-compacto (`48px`) do Terminal:
- Branding profissional com símbolo do índice sintético e status de latência.
- Sistema de **Abas de Múltiplos Ativos** (ex: `SYNTH_VOL_50` +85%, `EURUSD_OTC` +85%, `CRYPTO_100` +85%), com botão `[+]` para adicionar ativos e botão `[✕]` para fechar abas.
- **Seletor de Carteira / Conta** (Conta Demonstração $10,000 USD vs Conta Real $0,00 USD) com dropdown de recarga instantânea.
- **Botão "Depositar"** verde chamativo (`#00e676` / glowing neon) com atalho para recarga no ambiente demo e modal de checkout.

---

## 2. Especificação de Componentes

### Componente `TerminalHeader.tsx`
1. **Lado Esquerdo**:
   - Ícone da corretora + nome do terminal.
   - Carrossel horizontal de abas com scroll suave:
     - Cada aba exibe: Nome do Ativo, Badge de Lucro (`+85%` ou `95%`), estado ativo/inativo, e botão de fechar `✕` (exceto se for a única aba aberta).
     - Botão `[+]` estilizado para abrir modal de seleção de índices disponíveis (`SYNTH_VOL_50`, `SYNTH_VOL_75`, `EURUSD_OTC`, `BTCUSD_OTC`).
2. **Lado Direito**:
   - Indicador de Latência / Conexão (Ping em ms e status `Ao vivo` verde).
   - Seletor de Conta com Pill:
     - "CONTA DEMO" em amarelo/âmbar com saldo formatado em USD (ex: `$10.000,00`).
     - Ícone de recarga (para resetar saldo demo para $10.000 a qualquer momento).
   - Botão **DEPOSITAR**:
     - Estilo néon verde de alta visibilidade com efeito hover de elevação e pulso suave.

---

## 3. Matriz de Testes & Validação da Etapa 2

### A. Teste de Estresse (Troca Rápida de Abas)
- Alternar entre 4 abas ativas em menos de 100ms:
  - O gráfico deve atualizar a subscrição de mercado sem acúmulo de listeners ou vazamento de sockets.
  - O estado da boleta deve manter os inputs intactos para o ativo ativo.

### B. Teste de Integridade Financeira (I-01 a I-03)
- O valor do saldo na pill de conta deve ser estritamente calculado a partir de `available_minor` em centavos USD.
- A função de recarga demo deve emitir a mutação correspondente sem quebrar o estado local do Blnk ou da simulação guest.

### C. Teste de Caos (Fechamento da Última Aba)
- Fechar todas as abas: o sistema deve impedir o fechamento do último ativo aberto ou recriar instantaneamente a aba default (`SYNTH_VOL_50`).

---

## 4. Critérios de Passagem (Quality Gate 2)
- [ ] Build TypeScript / Vite 100% verde sem erros.
- [ ] Troca entre múltiplos ativos fluida e instantânea.
- [ ] Seletor Demo/Real atualiza o saldo corretamente em centavos.
- [ ] Botão Depositar abre modal ou feedback de recarga de forma limpa.
