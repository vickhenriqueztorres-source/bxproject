import React, { useState } from "react";

export interface AdminMirrorItem {
  id: string;
  domain_name: string;
  target_country: string | null;
  status: "ACTIVE" | "STANDBY" | "BLOCKED" | "DEAD";
  priority: number;
  latency_ms: number;
  last_health_check_at: string;
}

interface RegulatoryMirrorsPageProps {
  mirrors?: AdminMirrorItem[];
  onRotateDomain?: (blockedDomain: string, country?: string) => Promise<void>;
}

export const RegulatoryMirrorsPage: React.FC<RegulatoryMirrorsPageProps> = ({
  mirrors: initialMirrors = [
    { id: "1", domain_name: "app.nomedominio-br1.com", target_country: "BR", status: "ACTIVE", priority: 10, latency_ms: 15, last_health_check_at: "2026-10-08T03:00:00Z" },
    { id: "2", domain_name: "app.nomedominio-br2.com", target_country: "BR", status: "STANDBY", priority: 20, latency_ms: 18, last_health_check_at: "2026-10-08T03:00:00Z" },
    { id: "3", domain_name: "app.nomedominio-in.com", target_country: "IN", status: "ACTIVE", priority: 10, latency_ms: 45, last_health_check_at: "2026-10-08T03:00:00Z" },
    { id: "4", domain_name: "app.nomedominio-in2.com", target_country: "IN", status: "STANDBY", priority: 20, latency_ms: 50, last_health_check_at: "2026-10-08T03:00:00Z" },
    { id: "5", domain_name: "app.nomedominio-global.com", target_country: null, status: "ACTIVE", priority: 10, latency_ms: 30, last_health_check_at: "2026-10-08T03:00:00Z" }
  ],
  onRotateDomain
}) => {
  const [mirrors, setMirrors] = useState<AdminMirrorItem[]>(initialMirrors);
  const [rotating, setRotating] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const handleRotate = async (domain: string, country?: string | null) => {
    setRotating(domain);
    try {
      if (onRotateDomain) {
        await onRotateDomain(domain, country || undefined);
      }
      setMirrors(prev => prev.map(m => {
        if (m.domain_name === domain) return { ...m, status: "BLOCKED" };
        if (m.target_country === country && m.status === "STANDBY") return { ...m, status: "ACTIVE" };
        return m;
      }));
      setNotification(`Domínio ${domain} bloqueado com sucesso! Espelho reserva promovido.`);
    } catch (err: any) {
      setNotification(`Erro na rotação: ${err.message}`);
    } finally {
      setRotating(null);
    }
  };

  return (
    <div style={{ padding: "24px", color: "#e6edf3", backgroundColor: "#0d1117", minHeight: "100vh" }}>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 8px 0" }}>
            Rede de Domínios Espelho & Resiliência a Censura DNS
          </h1>
          <p style={{ color: "#8b949e", margin: 0, fontSize: "14px" }}>
            Governança de roteamento de borda, failover para Anatel/bloqueios judiciais e monitoramento de latência.
          </p>
        </div>
      </div>

      {notification && (
        <div style={{
          backgroundColor: "#161b22",
          border: "1px solid #388bfd",
          color: "#58a6ff",
          padding: "12px 16px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontSize: "14px"
        }}>
          ℹ️ {notification}
        </div>
      )}

      <div style={{
        backgroundColor: "#161b22",
        borderRadius: "12px",
        border: "1px solid #30363d",
        overflow: "hidden"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d", backgroundColor: "#0d1117", color: "#8b949e" }}>
              <th style={{ padding: "12px 16px" }}>Domínio</th>
              <th style={{ padding: "12px 16px" }}>País / Região</th>
              <th style={{ padding: "12px 16px" }}>Status</th>
              <th style={{ padding: "12px 16px" }}>Prioridade</th>
              <th style={{ padding: "12px 16px" }}>Latência</th>
              <th style={{ padding: "12px 16px" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {mirrors.map((m) => {
              const isActive = m.status === "ACTIVE";
              const isBlocked = m.status === "BLOCKED";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#ffffff" }}>
                    {m.domain_name}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {m.target_country ? `🇧🇷 ${m.target_country}` : "🌐 Global"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      backgroundColor: isActive ? "rgba(34, 197, 94, 0.2)" : isBlocked ? "rgba(239, 68, 68, 0.2)" : "rgba(234, 179, 8, 0.2)",
                      color: isActive ? "#4ade80" : isBlocked ? "#f87171" : "#facc15"
                    }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#8b949e" }}>
                    #{m.priority}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {m.latency_ms} ms
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {isActive ? (
                      <button
                        onClick={() => handleRotate(m.domain_name, m.target_country)}
                        disabled={rotating === m.domain_name}
                        style={{
                          backgroundColor: "#da3633",
                          border: "none",
                          color: "#ffffff",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                      >
                        {rotating === m.domain_name ? "Rotacionando..." : "Rotacionar (Bloquear)"}
                      </button>
                    ) : (
                      <span style={{ color: "#8b949e", fontSize: "12px" }}>Reserva</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
