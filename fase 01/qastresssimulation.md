name: qa-stress-simulation
description: >
Trigger: "QA agent", "stress test", "load test", "chaos test", "simulate users",
"test WebSocket", "k6 test", "soak test", "validate Phase 1", "test contracts".
Always activate before creating or running QA, load, chaos, soak or user-simulation
tests for the synthetic-index platform. Creates tests only under /tests and /load,
runs them in isolated staging/local environments, and produces an evidence-based
report. Never runs destructive tests against production.
Activation Rules
Activate when the user says
"crie teste de carga"
"rode teste de estresse"
"simule 300 usuários"
"teste WebSocket"
"teste caos"
"valide a Fase 1"
"crie teste k6"
"teste settlement duplicado"
"teste reconexão WebSocket"
"rode QA na Fase 1"
Do NOT activate when
O usuário pede apenas explicação conceitual de QA.
O usuário pede código de produção fora de /tests ou /load.
O ambiente é produção.
Não existe especificação da funcionalidade a testar.
A tarefa é apenas revisão de código sem execução de teste.
Mission
Provar que a Fase 1 aguenta usuários reais, picos, falhas e comportamento anômalo
sem corromper dinheiro, saldo, contrato ou histórico.
Hard Rules
Nunca execute teste destrutivo em produção.
Use apenas ambiente local ou staging isolado.
Escreva testes apenas em /tests e /load.
Não altere código de produção.
Não altere dados reais.
Não apague, comente ou enfraqueça um teste que falhou.
Sempre teste idempotência em operação financeira.
Sempre teste falha de dependência crítica.
Sempre valide saldo derivado do ledger.
Sempre gere relatório com cenário, resultado, evidência e recomendação.
Se um teste falhar, investigue a causa antes de alterar qualquer coisa.
Nunca declare "passou" sem evidência executável.
Test Matrix
Required Test Scenarios
1. Smoke
Login via Keycloak.
Ver saldo demo.
Carregar gráfico.
Receber tick via WebSocket.
Abrir contrato UP.
Aguardar expiração.
Ver resultado.
Ver histórico.
2. Funcional
UP vence quando preço sobe.
DOWN vence quando preço desce.
Empate devolve stake.
Payout é 185% do stake.
Cancelamento só nos primeiros 3 segundos.
Contrato fora do intervalo é rejeitado.
3. Idempotência
Mesma Idempotency-Key cria apenas um contrato.
Repetir POST /contracts retorna o mesmo contrato.
Repetir settlement não credita duas vezes.
Mensagem duplicada no Stream não altera saldo duas vezes.
4. Carga
300 WebSockets simultâneos.
50 contratos por minuto.
p95 de abertura < 200 ms.
p95 de tick < 200 ms.
Erro HTTP < 1%.
Zero settlement duplicado.
Zero divergência de saldo.
5. Pico
Ramp-up de 0 para 300 usuários em 1 minuto.
Manter 300 por 5 minutos.
Ramp-down controlado.
Nenhum erro 5xx acima de 1%.
6. Soak
30 a 60 minutos com conexões abertas.
Verificar vazamento de memória.
Verificar crescimento indevido de conexões.
Verificar divergência de saldo.
Verificar atraso crescente de tick.
7. Caos
Matar tick engine.
Matar candle worker.
Matar settlement worker.
Derrubar Redis.
Derrubar Postgres.
Duplicar mensagem do Stream.
Enviar tick fora de ordem.
Reusar refresh token.
Fechar WebSocket abruptamente.
Approval Thresholds
Report Format
Para cada execução, entregue:
# QA Report — <data>

## Cenário
<nome do teste>

## Ambiente
<local | staging>

## Comando executado
<comando real>

## Resultado
PASS | FAIL | BLOCKED

## Métricas
- p95: <valor>
- erro HTTP: <valor>
- WebSockets: <valor>
- contratos/minuto: <valor>
- settlement duplicado: <valor>
- saldo divergente: <valor>

## Evidências
- Link/arquivo do resultado
- Log relevante
- Screenshot, se aplicável

## Falhas
- Causa provável
- Componente afetado
- Evidência
- Recomendação

## Decisão
APROVADO | REPROVADO | BLOQUEADO
k6 Example
import websocket from "k6/websockets";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "2m", target: 300 },
    { duration: "5m", target: 300 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    ws_connecting: ["p(95)<500"],
    ws_msgs_received: ["count>0"],
  },
};

export default function () {
  const url = "wss://staging.example.com/ws?symbol=SYNTH_VOL_50";
  const ws = new websocket(url);

  ws.on("message", (data) => {
    const message = JSON.parse(data);

    check(message, {
      "has price": (msg) => msg.price !== undefined,
      "has sequence": (msg) => msg.sequence !== undefined,
      "sequence is number": (msg) => typeof msg.sequence === "number",
    });
  });
}
Edge Cases
Se não houver ambiente staging, execute apenas local e diga isso no relatório.
Se o WebSocket não estiver disponível, bloqueie testes de carga e explique.
Se o teste falhar por dados de seed ausentes, crie fixture em /tests/fixtures.
Se houver divergência de saldo, pare a suíte e gere relatório crítico.
Se o agente não tiver permissão para rodar Docker, entregue comandos e relatório esperado.
Se o teste falhar, nunca altere produção nem apague o teste.
References
Detalhes de cenários: references/test-scenarios.md
Exemplos completos: examples/
