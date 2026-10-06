import React, { useState } from "react";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"indices" | "contracts" | "audit">("indices");
  const [indexStatus, setIndexStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [justification, setJustification] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<Array<{ time: string; action: string; reason: string }>>([
    { time: "2026-10-06 04:00:00", action: "INITIALIZE_PLATFORM", reason: "Deploy inicial da Fase 1 MVP" }
  ]);

  const handleToggleIndex = () => {
    if (!justification.trim()) {
      alert("Justificativa obrigatória para auditoria (B-14)!");
      return;
    }

    const newStatus = indexStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setIndexStatus(newStatus);
    setAuditLogs([
      {
        time: new Date().toLocaleTimeString(),
        action: newStatus === "PAUSED" ? "PAUSE_INDEX_SYNTH_VOL_50" : "RESUME_INDEX_SYNTH_VOL_50",
        reason: justification
      },
      ...auditLogs
    ]);

    setJustification("");
    setShowModal(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0E14", color: "#FFFFFF", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        height: "60px",
        background: "#161A25",
        borderBottom: "1px solid #2B2F3A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>
            SYNTH<span style={{ color: "#F6C344" }}>ADMIN</span>
          </h2>
          <span style={{ background: "#2B2F3A", fontSize: "11px", padding: "3px 8px", borderRadius: "4px", color: "#F6C344" }}>
            PORTAL ADMINISTRATIVO & AUDITORIA
          </span>
        </div>

        <nav style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setActiveTab("indices")}
            style={{
              background: activeTab === "indices" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "indices" ? "bold" : "normal"
            }}
          >
            Gestão de Ativos
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            style={{
              background: activeTab === "contracts" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "contracts" ? "bold" : "normal"
            }}
          >
            Monitor de Ordens
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            style={{
              background: activeTab === "audit" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "audit" ? "bold" : "normal"
            }}
          >
            Reconciliação & Auditoria
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main style={{ padding: "24px", flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {activeTab === "indices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Ativos Sintéticos Cadastrados</h3>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px",
                background: "#0B0E14",
                borderRadius: "6px",
                border: "1px solid #2B2F3A"
              }}>
                <div>
                  <h4 style={{ fontSize: "16px", fontWeight: "bold" }}>SYNTH_VOL_50</h4>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Synthetic Volatility 50 Index (Ornstein-Uhlenbeck OTC)
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    background: indexStatus === "ACTIVE" ? "rgba(8, 153, 129, 0.2)" : "rgba(242, 54, 69, 0.2)",
                    color: indexStatus === "ACTIVE" ? "#089981" : "#F23645"
                  }}>
                    {indexStatus === "ACTIVE" ? "EM OPERAÇÃO" : "PAUSADO"}
                  </span>

                  <button
                    onClick={() => setShowModal(true)}
                    style={{
                      background: indexStatus === "ACTIVE" ? "#F23645" : "#089981",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    {indexStatus === "ACTIVE" ? "Pausar Ativo" : "Retomar Ativo"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Log de Auditoria de Ações Administrativas (audit_logs)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                    <th style={{ padding: "8px" }}>Horário</th>
                    <th style={{ padding: "8px" }}>Ação</th>
                    <th style={{ padding: "8px" }}>Justificativa Obrigatória</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #1E222D" }}>
                      <td style={{ padding: "8px" }}>{log.time}</td>
                      <td style={{ padding: "8px", fontWeight: "bold" }}>{log.action}</td>
                      <td style={{ padding: "8px", color: "#9B9FA4" }}>{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "contracts" && (
          <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Visão Geral de Ordens e Exposição de Risco</h3>
            <p style={{ fontSize: "13px", color: "#9B9FA4", marginBottom: "20px" }}>
              Monitoramento em tempo real do teto de risco de solvência (3% do Float).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Capital Float da Plataforma</span>
                <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFFFFF", marginTop: "4px" }}>$1.000.000,00</h4>
              </div>
              <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Teto Máximo por Vela (3%)</span>
                <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#F6C344", marginTop: "4px" }}>$30.000,00</h4>
              </div>
              <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Payout Fixo</span>
                <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#089981", marginTop: "4px" }}>85% (Fase 1)</h4>
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Status do Reconciliador Financeiro Contínuo (1 Minuto)</h3>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                ✓ [I-02] Soma Zero no Blnk: Débitos e créditos rigorosamente equilibrados (0 divergências)
              </li>
              <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                ✓ [I-03] Contratos Abertos vs Garantia: Soma de stakes conferida com saldo reservado no ledger
              </li>
              <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                ✓ [M-02] Sequenciamento de Ticks: Numeração contínua sem saltos ou furos
              </li>
              <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                ✓ [M-04] Criptografia de Ticks: Corrente SHA-256 íntegra nos últimos 500 ticks
              </li>
            </ul>

            <div style={{ marginTop: "24px", padding: "12px", background: "rgba(246, 195, 68, 0.1)", border: "1px solid #F6C344", borderRadius: "6px", fontSize: "12px", color: "#F6C344" }}>
              🛡️ <strong>Invariante I-01:</strong> Nenhuma alteração manual de saldo de usuários é permitida pelo painel administrativo. Saldo só existe e se move por transações auditáveis no Blnk.
            </div>
          </div>
        )}
      </main>

      {/* Modal de Justificativa para Pausa */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{ background: "#161A25", padding: "24px", borderRadius: "8px", width: "420px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "16px" }}>Confirmação de Ação Administrativa</h3>
            <p style={{ fontSize: "13px", color: "#9B9FA4" }}>
              Por requisitos de auditoria forense (B-14), justifique o motivo desta alteração:
            </p>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Manutenção programada da infraestrutura de ticks..."
              style={{
                background: "#0B0E14",
                border: "1px solid #2B2F3A",
                borderRadius: "6px",
                color: "#FFFFFF",
                padding: "10px",
                fontSize: "13px",
                resize: "none"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#2B2F3A", border: "none", color: "#FFFFFF", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleIndex}
                style={{ background: "#F23645", border: "none", color: "#FFFFFF", padding: "8px 14px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Confirmar e Gravar Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
