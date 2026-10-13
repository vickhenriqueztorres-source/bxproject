import React from "react";

interface RegulatoryBlockedScreenProps {
  country?: string;
  regulatorAuthority?: string;
}

export const RegulatoryBlockedScreen: React.FC<RegulatoryBlockedScreenProps> = ({
  country = "United States",
  regulatorAuthority = "SEC/CFTC/ESMA"
}) => {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#0b0e14",
      color: "#f3f4f6",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "24px"
    }}>
      <div style={{
        maxWidth: "540px",
        width: "100%",
        backgroundColor: "#161b22",
        borderRadius: "16px",
        border: "1px solid #30363d",
        padding: "36px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        textAlign: "center"
      }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          margin: "0 auto 20px auto"
        }}>
          🛑
        </div>

        <h1 style={{
          fontSize: "22px",
          fontWeight: "700",
          marginBottom: "12px",
          color: "#ffffff"
        }}>
          Service Unavailable in Your Jurisdiction
        </h1>

        <p style={{
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#9ca3af",
          marginBottom: "24px"
        }}>
          Due to regulatory restrictions imposed by local authorities (<strong>{regulatorAuthority}</strong>), 
          retail trading of synthetic contracts and binary derivatives is strictly prohibited for residents 
          and citizens in <strong>{country}</strong>.
        </p>

        <div style={{
          backgroundColor: "#0d1117",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #21262d",
          fontSize: "12px",
          color: "#8b949e",
          textAlign: "left",
          lineHeight: "1.5"
        }}>
          <strong>Regulatory Compliance Notice:</strong>
          <br />
          Our platform operates in strict accordance with international legal frameworks. IP addresses and connection requests originating from prohibited jurisdictions are automatically filtered at the Edge CDN layer.
        </div>

        <div style={{ marginTop: "28px" }}>
          <a
            href="https://www.google.com"
            style={{
              display: "inline-block",
              backgroundColor: "#238636",
              color: "#ffffff",
              padding: "10px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Leave Site
          </a>
        </div>
      </div>
    </div>
  );
};
