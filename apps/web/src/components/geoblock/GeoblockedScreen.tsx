import React from "react";
import { useTranslation } from "../../i18n";

export interface GeoblockedScreenProps {
  detectedCountry?: string;
  onRetry?: () => void;
}

export const GeoblockedScreen: React.FC<GeoblockedScreenProps> = ({ detectedCountry = "UNKNOWN", onRetry }) => {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B0E14",
      color: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "sans-serif"
    }}>
      <div style={{
        maxWidth: "520px",
        width: "100%",
        background: "#161A25",
        border: "1px solid #2B2F3A",
        borderRadius: "12px",
        padding: "36px 32px",
        textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
      }}>
        {/* Seletor de Idioma Rápido */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => setLocale("pt-BR")}
            style={{
              background: locale === "pt-BR" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "1px solid #2B2F3A",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            🇧🇷 PT
          </button>
          <button
            onClick={() => setLocale("es-ES")}
            style={{
              background: locale === "es-ES" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "1px solid #2B2F3A",
              borderRadius: "4px",
              padding: "4px 8px",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            🇪🇸 ES
          </button>
        </div>

        {/* Ícone de Escudo de Proteção */}
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "rgba(242, 54, 69, 0.15)",
          color: "#F23645",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          margin: "0 auto 20px"
        }}>
          🛡️
        </div>

        <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" }}>
          {t("geoblock.title")}
        </h2>

        <p style={{ fontSize: "14px", color: "#9B9FA4", lineHeight: "1.6", marginBottom: "16px" }}>
          {t("geoblock.message")}
        </p>

        {/* Lista dos 6 Países */}
        <div style={{
          background: "#0B0E14",
          border: "1px solid #2B2F3A",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", fontWeight: "bold" }}>
            <div>🇧🇷 Brasil</div>
            <div>🇲🇽 México</div>
            <div>🇨🇴 Colômbia</div>
            <div>🇦🇷 Argentina</div>
            <div>🇨🇱 Chile</div>
            <div>🇵🇪 Peru</div>
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "#6A7182", lineHeight: "1.5", marginBottom: "24px" }}>
          {t("geoblock.support")} {detectedCountry && detectedCountry !== "UNKNOWN" && `(Região detectada: ${detectedCountry})`}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: "#F6C344",
              color: "#0B0E14",
              border: "none",
              padding: "12px 24px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              width: "100%"
            }}
          >
            {t("geoblock.button_retry")}
          </button>
        )}
      </div>
    </div>
  );
};
