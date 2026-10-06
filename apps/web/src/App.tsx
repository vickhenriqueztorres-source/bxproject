import React, { useState, useEffect, useRef } from "react";
import { TradingViewCanvas } from "./components/chart/TradingViewCanvas.tsx";
import { TradeTicket } from "./components/trading/TradeTicket.tsx";
import { DemoWallet } from "./components/wallet/DemoWallet.tsx";
import { ContractHistory } from "./components/trading/ContractHistory.tsx";

export const App: React.FC = () => {
  const [symbol, setSymbol] = useState<string>("SYNTH_VOL_50");
  const [lastTick, setLastTick] = useState<{ sequence: string; price: string; ts: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // 1. Autenticação na primeira mensagem (S-02)
      ws.send(JSON.stringify({ type: "auth", token: "demo-jwt-token" }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "auth_ok") {
          // 2. Inscreve no símbolo com catch-up
          ws.send(JSON.stringify({ type: "subscribe", symbol }));
        } else if (msg.price && msg.sequence) {
          // Tick ao vivo recebido do motor
          setLastTick({
            sequence: msg.sequence,
            price: msg.price,
            ts: msg.ts
          });
        } else if (msg.event === "CONTRACT_SETTLED") {
          // Notificação de liquidação de contrato
          setRefreshTrigger((prev) => prev + 1);
        }
      } catch (err) {
        // Ignora erros de parse
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol]);

  const handleContractOpened = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      background: "#0B0E14",
      overflow: "hidden"
    }}>
      {/* Top Navbar */}
      <header style={{
        height: "60px",
        background: "#161A25",
        borderBottom: "1px solid #2B2F3A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "#FFFFFF", letterSpacing: "0.5px" }}>
            SYNTH<span style={{ color: "#089981" }}>BROKER</span>
          </h1>
          <div style={{
            background: "#0B0E14",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #2B2F3A",
            fontSize: "13px",
            fontWeight: "bold",
            color: "#FFFFFF"
          }}>
            {symbol} (OTC 24x7)
          </div>
          {lastTick && (
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#089981" }}>
              ${lastTick.price}
            </div>
          )}
        </div>

        <DemoWallet refreshTrigger={refreshTrigger} />
      </header>

      {/* Main Workspace */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Side: Chart and History */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px", gap: "16px", minWidth: 0 }}>
          <div style={{ flex: 1, background: "#161A25", borderRadius: "8px", overflow: "hidden", minHeight: "350px" }}>
            <TradingViewCanvas symbol={symbol} lastTick={lastTick} />
          </div>
          <ContractHistory refreshTrigger={refreshTrigger} />
        </div>

        {/* Right Side: Trade Ticket */}
        <div style={{ padding: "16px 16px 16px 0", display: "flex" }}>
          <TradeTicket symbol={symbol} onContractOpened={handleContractOpened} />
        </div>
      </div>
    </div>
  );
};
