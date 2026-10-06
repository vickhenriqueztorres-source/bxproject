import React, { useEffect, useState } from "react";

interface Contract {
  id: string;
  symbol: string;
  direction: "UP" | "DOWN";
  status: "OPEN" | "SETTLED" | "CANCELLED";
  result?: "WIN" | "LOSS" | "DRAW";
  stake_minor: number;
  payout_minor: number;
  entry_price: string;
  exit_price?: string;
  opened_at: string;
  expires_at: string;
}

export const ContractHistory: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);

  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/v1/contracts");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch (err) {
      console.error("Failed to load contracts:", err);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [refreshTrigger]);

  const getStatusBadge = (contract: Contract) => {
    if (contract.status === "OPEN") {
      return <span style={{ background: "#2B2F3A", color: "#F6C344", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>ABERTO</span>;
    }
    if (contract.result === "WIN") {
      return <span style={{ background: "rgba(8, 153, 129, 0.2)", color: "#089981", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>VITÓRIA (+${(contract.payout_minor / 100).toFixed(2)})</span>;
    }
    if (contract.result === "LOSS") {
      return <span style={{ background: "rgba(242, 54, 69, 0.2)", color: "#F23645", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>DERROTA (-${(contract.stake_minor / 100).toFixed(2)})</span>;
    }
    return <span style={{ background: "#2B2F3A", color: "#9B9FA4", padding: "3px 8px", borderRadius: "4px", fontSize: "11px" }}>EMPATE</span>;
  };

  return (
    <div style={{
      background: "#161A25",
      borderRadius: "8px",
      padding: "16px",
      height: "180px",
      overflowY: "auto",
      color: "#FFFFFF"
    }}>
      <h4 style={{ fontSize: "13px", color: "#9B9FA4", marginBottom: "12px", textTransform: "uppercase" }}>
        Histórico Recente de Operações
      </h4>

      {contracts.length === 0 ? (
        <div style={{ color: "#5E636E", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
          Nenhuma operação recente realizada.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ color: "#5E636E", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
              <th style={{ padding: "6px" }}>Ativo</th>
              <th style={{ padding: "6px" }}>Direção</th>
              <th style={{ padding: "6px" }}>Entrada</th>
              <th style={{ padding: "6px" }}>Saída</th>
              <th style={{ padding: "6px" }}>Investimento</th>
              <th style={{ padding: "6px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.slice(0, 10).map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #1E222D" }}>
                <td style={{ padding: "6px", fontWeight: "bold" }}>{c.symbol}</td>
                <td style={{ padding: "6px", color: c.direction === "UP" ? "#089981" : "#F23645", fontWeight: "bold" }}>
                  {c.direction === "UP" ? "▲ ALTA" : "▼ BAIXA"}
                </td>
                <td style={{ padding: "6px" }}>{c.entry_price}</td>
                <td style={{ padding: "6px" }}>{c.exit_price || "-"}</td>
                <td style={{ padding: "6px" }}>${(c.stake_minor / 100).toFixed(2)}</td>
                <td style={{ padding: "6px" }}>{getStatusBadge(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
