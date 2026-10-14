import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TickCoalescer, type TickMessage } from "../src/coalescer.js";
import { BackpressureGuard, type SocketLike } from "../src/backpressure.js";
import { SymbolShardingRouter } from "../src/sharding.js";

describe("[Subetapa 01 — Perigo 4] Fan-Out Escalável: Coalescing (50ms), Backpressure (64KB/5s) e Sharding", () => {
  it("[ESTRESSE] TickCoalescer consolida 1.000 ticks em 50ms emitindo apenas o mais fresco e ignora regressão de sequence", async () => {
    const coalescer = new TickCoalescer({ windowMs: 30 });
    const emitted: TickMessage[] = [];

    for (let seq = 1; seq <= 1000; seq++) {
      coalescer.push(
        {
          symbol: "R_100",
          sequence: seq,
          price: (100 + seq * 0.01).toFixed(2),
          ts: new Date().toISOString(),
        },
        (tick) => emitted.push(tick)
      );
    }

    // Tenta injetar tick atrasado (sequence 500 < 1000) dentro da mesma janela
    coalescer.push(
      {
        symbol: "R_100",
        sequence: 500,
        price: "99.00",
        ts: new Date().toISOString(),
      },
      (tick) => emitted.push(tick)
    );

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(emitted.length, 1, "Deve emitir exatamente 1 tick consolidado após a janela");
    assert.equal(emitted[0].sequence, 1000, "Deve preservar o tick de maior sequence (1000)");
    assert.equal(coalescer.getDroppedCount(), 1000, "999 intermediários + 1 atrasado descartados");
    assert.equal(coalescer.getEmittedCount(), 1);
    coalescer.destroy();
  });

  it("[CAOS] BackpressureGuard pausa envio acima de 64KB, retoma após drain/clearSocket e expulsa slow consumer após 5s", () => {
    let fakeNow = 1_700_000_000_000;
    const guard = new BackpressureGuard(
      { maxBufferedBytes: 64 * 1024, slowClientTimeoutMs: 5000 },
      () => fakeNow
    );

    let closedWith: { code?: number; reason?: string } | null = null;
    const mockSocket: SocketLike = {
      bufferedAmount: 0,
      readyState: 1,
      close(code?: number, reason?: string) {
        closedWith = { code, reason };
        this.readyState = 3;
      },
    };

    // 1. Socket saudável (<= 64KB)
    assert.equal(guard.shouldSend(mockSocket), true);

    // 2. Socket congestionado (> 64KB) -> pausa envio imediatamente
    mockSocket.bufferedAmount = 70 * 1024;
    assert.equal(guard.shouldSend(mockSocket), false);
    assert.equal(guard.getPausedCount(), 1);

    // 3. Passam 3s (< 5s) ainda congestionado -> continua pausado, mas não desconecta
    fakeNow += 3000;
    assert.equal(guard.shouldSend(mockSocket), false);
    assert.equal(closedWith, null);

    // 4. Evento drain / clearSocket -> retoma operação
    guard.handleDrain(mockSocket);
    mockSocket.bufferedAmount = 1024;
    assert.equal(guard.getPausedCount(), 0);
    assert.equal(guard.shouldSend(mockSocket), true);

    // 5. Satura novamente e permanece > 64KB por >= 5000ms -> desconecta com 4429
    mockSocket.bufferedAmount = 128 * 1024;
    assert.equal(guard.shouldSend(mockSocket), false);
    fakeNow += 5001;
    assert.equal(guard.shouldSend(mockSocket), false);
    assert.deepEqual(closedWith, {
      code: 4429,
      reason: "Slow client backpressure timeout",
    });
    assert.equal(guard.getDisconnectedCount(), 1);
  });

  it("[PARTICIONAMENTO] SymbolShardingRouter distribui símbolos determinísticamente e filtra nós via isAssignedToNode", () => {
    const router4 = new SymbolShardingRouter(4);
    const symbols = ["R_10", "R_25", "R_50", "R_75", "R_100", "BTCUSDT", "ETHUSDT", "EURUSD-OTC"];

    for (const sym of symbols) {
      const assignedNode = router4.getNodeIndex(sym);
      assert.equal(assignedNode >= 0 && assignedNode < 4, true);

      // Apenas 1 dos 4 nós deve retornar true em isAssignedToNode
      let matches = 0;
      for (let nodeId = 0; nodeId < 4; nodeId++) {
        if (router4.isAssignedToNode(sym, nodeId)) {
          matches++;
          assert.equal(nodeId, assignedNode);
        }
      }
      assert.equal(matches, 1, `Símbolo ${sym} deve pertencer a exatamente 1 shard`);
    }
  });
});
