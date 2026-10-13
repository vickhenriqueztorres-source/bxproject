import React from "react";

interface KYCTierBadgeProps {
  tier: "TIER_0" | "TIER_1";
  status: "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";
  depositLimitMinor: number;
  cumulativeDepositedMinor?: number;
  onUpgradeClick?: () => void;
}

export const KYCTierBadge: React.FC<KYCTierBadgeProps> = ({
  tier,
  status,
  depositLimitMinor,
  cumulativeDepositedMinor = 0,
  onUpgradeClick
}) => {
  const isTier0 = tier === "TIER_0";
  const limitUsd = (depositLimitMinor / 100).toFixed(0);
  const usedUsd = (cumulativeDepositedMinor / 100).toFixed(0);
  const percentage = Math.min(100, Math.round((cumulativeDepositedMinor / depositLimitMinor) * 100));

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      backgroundColor: "#161b22",
      border: "1px solid #30363d",
      borderRadius: "8px",
      padding: "6px 12px",
      fontSize: "12px",
      color: "#e6edf3"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{
          backgroundColor: isTier0 ? "#d97706" : "#22c55e",
          color: "#ffffff",
          padding: "2px 6px",
          borderRadius: "4px",
          fontWeight: "700",
          fontSize: "10px"
        }}>
          {isTier0 ? "TIER 0 (Fast)" : "TIER 1 (Verified)"}
        </span>
        <span style={{ color: "#8b949e" }}>
          Limite: ${usedUsd}/${limitUsd}
        </span>
      </div>

      {isTier0 && (
        <button
          onClick={onUpgradeClick}
          style={{
            backgroundColor: "#238636",
            border: "none",
            color: "#ffffff",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          Upgrade ID
        </button>
      )}

      {status === "REJECTED" && (
        <span style={{ color: "#ef4444", fontWeight: "600", fontSize: "11px" }}>
          ❌ Bloqueado
        </span>
      )}
    </div>
  );
};
