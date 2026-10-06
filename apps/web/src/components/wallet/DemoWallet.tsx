import React, { useEffect, useState } from "react";

interface WalletData {
  available_minor: number;
  reserved_minor: number;
  currency: string;
}

export const DemoWallet: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/v1/wallet");
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [refreshTrigger]);

  const formatCurrency = (minorCents: number) => {
    const dollars = minorCents / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD"
    }).format(dollars);
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "#161A25",
      padding: "6px 14px",
      borderRadius: "20px",
      border: "1px solid #2B2F3A"
    }}>
      <span style={{
        background: "#F6C344",
        color: "#000000",
        fontWeight: "bold",
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "10px"
      }}>
        DEMO
      </span>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "11px", color: "#9B9FA4" }}>Saldo da Conta</span>
        <span style={{ fontSize: "15px", fontWeight: "bold", color: "#FFFFFF" }}>
          {loading ? "Carregando..." : wallet ? formatCurrency(wallet.available_minor) : "$10.000,00"}
        </span>
      </div>
    </div>
  );
};
