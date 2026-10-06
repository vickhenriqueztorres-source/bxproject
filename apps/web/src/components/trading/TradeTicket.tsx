import React, { useState, useEffect } from "react";

interface TradeTicketProps {
  symbol: string;
  onContractOpened: () => void;
}

export const TradeTicket: React.FC<TradeTicketProps> = ({ symbol, onContractOpened }) => {
  const [direction, setDirection] = useState<"UP" | "DOWN">("UP");
  const [stakeUsd, setStakeUsd] = useState<number>(10); // US$ 10 padrão
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsToClose, setSecondsToClose] = useState<number>(60);

  // Monitora a contagem regressiva da vela de 1 minuto para a trava de 30s
  useEffect(() => {
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const remainingSec = 60 - (nowSec % 60);
      setSecondsToClose(remainingSec);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocked = secondsToClose <= 30; // Trava nos últimos 30 segundos da vela (F-01, F-11)
  const stakeMinor = Math.round(stakeUsd * 100);
  const potentialProfitUsd = (stakeUsd * 0.85).toFixed(2);
  const totalReturnUsd = (stakeUsd * 1.85).toFixed(2);

  const handleSubmitOrder = async (selectedDir: "UP" | "DOWN") => {
    if (isSubmitting || isLocked) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Geração de UUIDv4 exclusivo como Idempotency-Key para cada clique (F-10, B-05)
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch("/api/v1/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          symbol,
          direction: selectedDir,
          stake_minor: stakeMinor
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "RISK_LIMIT_EXCEEDED") {
          setErrorMessage("Teto de risco da plataforma atingido para esta vela. Tente a próxima.");
        } else {
          setErrorMessage(data.message || "Falha ao abrir contrato.");
        }
      } else {
        onContractOpened();
      }
    } catch (err) {
      setErrorMessage("Erro de conexão ao enviar a ordem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      background: "#161A25",
      borderRadius: "8px",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      color: "#FFFFFF",
      width: "300px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Boleta de Negociação</h3>
        <span style={{
          fontSize: "12px",
          color: isLocked ? "#F23645" : "#089981",
          fontWeight: "bold",
          background: "#0B0E14",
          padding: "4px 8px",
          borderRadius: "4px"
        }}>
          ⏱ Expiração: {secondsToClose}s
        </span>
      </div>

      {isLocked && (
        <div style={{
          background: "rgba(242, 54, 69, 0.15)",
          border: "1px solid #F23645",
          borderRadius: "6px",
          padding: "10px",
          fontSize: "12px",
          color: "#FFA2A2",
          lineHeight: "1.4"
        }}>
          ⚠️ <strong>Entradas travadas:</strong> Últimos 30s da vela. Nova entrada liberada no próximo minuto.
        </div>
      )}

      <div>
        <label style={{ fontSize: "12px", color: "#9B9FA4", display: "block", marginBottom: "6px" }}>
          Valor do Investimento (USD)
        </label>
        <div style={{ display: "flex", alignItems: "center", background: "#0B0E14", borderRadius: "6px", padding: "8px 12px" }}>
          <span style={{ color: "#9B9FA4", marginRight: "6px" }}>$</span>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={stakeUsd}
            onChange={(e) => setStakeUsd(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: "bold",
              width: "100%",
              outline: "none"
            }}
          />
        </div>
      </div>

      <div style={{ background: "#0B0E14", borderRadius: "6px", padding: "12px", fontSize: "13px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ color: "#9B9FA4" }}>Lucro Potencial (+85%):</span>
          <span style={{ color: "#089981", fontWeight: "bold" }}>+${potentialProfitUsd}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#9B9FA4" }}>Retorno Total:</span>
          <span style={{ color: "#FFFFFF", fontWeight: "bold" }}>${totalReturnUsd}</span>
        </div>
      </div>

      {errorMessage && (
        <div style={{ color: "#F23645", fontSize: "12px", background: "rgba(242, 54, 69, 0.1)", padding: "8px", borderRadius: "4px" }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button
          disabled={isLocked || isSubmitting}
          onClick={() => handleSubmitOrder("UP")}
          style={{
            flex: 1,
            background: isLocked ? "#333A48" : "#089981",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            padding: "14px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: isLocked ? "not-allowed" : "pointer",
            transition: "all 0.2s"
          }}
        >
          ▲ ALTA (UP)
        </button>

        <button
          disabled={isLocked || isSubmitting}
          onClick={() => handleSubmitOrder("DOWN")}
          style={{
            flex: 1,
            background: isLocked ? "#333A48" : "#F23645",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            padding: "14px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: isLocked ? "not-allowed" : "pointer",
            transition: "all 0.2s"
          }}
        >
          ▼ BAIXA (DOWN)
        </button>
      </div>
    </div>
  );
};
