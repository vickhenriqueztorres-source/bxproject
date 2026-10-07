# Subetapa 1 — Execução Confiável de Ordens no Frontend & Feed de Desenvolvimento

## 1. Objetivo
Garantir que a ação do usuário de enviar uma ordem (COMPRA ou VENDA) no `OrderTicket.tsx` seja executada com sucesso imediato em qualquer ambiente (Modo Convidado Demo, Preview em Desenvolvimento ou Produção Autenticada), eliminando o erro `"Não foi possível enviar a ordem."`.

## 2. Implementação Necessária

### 2.1 Em `apps/web/src/api/client.ts`
Implementar suporte completo em `openContract`:
1. **Validação de Saldo Pré-Ordem:** Verificar se `available_minor >= stakeMinor`. Se insuficiente, lançar `ApiError(400, 'INSUFFICIENT_BALANCE')`.
2. **Reserva Contábil Demo:** Deduzir `available_minor -= stakeMinor` e incrementar `reserved_minor += stakeMinor`.
3. **Captura Fiel do Preço de Entrada:** Capturar o preço de entrada a partir da cotação viva mais recente do símbolo selecionado.
4. **Criação do Contrato:** Gerar identificador único `guest_<uuid>`, `direction`, `stake_minor`, `entry_price`, `strike_price`, `expires_at` (now + 60s) e status `OPEN`.
5. **Persistência em SessionStorage e Broadcast Reativo:** Salvar no mock store e emitir eventos privados (`wallet_balance`) para atualizar o cabeçalho imediatamente.
6. **Agendamento da Liquidação:** Agendar liquidação automática após a expiração contra o tick oficial do mesmo ativo, calculando payout de 85% e notificando o usuário.

### 2.2 Em `scripts/dev-live-feed.mjs`
Adicionar manipulador REST para requisições HTTP:
- `POST /api/contracts` ou `POST /contracts`: Aceitar payload com `{ symbol, direction, stake_minor }`, validar símbolo existente e retornar recibo HTTP 201 com `{ id, expires_at, status: 'OPEN' }`.
- `GET /api/wallet` ou `GET /wallet`: Retornar `{ currency: 'USD', available_minor: 1000000, reserved_minor: 0 }`.
- `GET /api/indices/:symbol` ou `GET /indices/:symbol`: Retornar status do ativo `{ symbol, status: 'ACTIVE' }`.

## 3. Critérios de Aceite e Testes
- Envio de ordem UP e DOWN retorna recibo válido.
- O saldo do usuário deduz o stake no exato momento da abertura.
- A linha de strike horizontal é renderizada no gráfico correspondente com título e cor da direção.
- Após 60 segundos, a ordem liquida contra o tick real do ativo.
