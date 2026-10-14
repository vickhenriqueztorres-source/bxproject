import React, { useState } from "react";

interface CountryAdminItem {
  code: string;
  name: string;
  flagEmoji: string;
  defaultCurrency: string;
  defaultLocale: string;
  isActive: boolean;
  tradingEnabled: boolean;
  otcRealFeed: boolean;
  demoWallet: boolean;
}

interface GeoblockLogItem {
  id: string;
  timestamp: string;
  country: string;
  maskedIp: string;
  reason: string;
  status: number;
}

interface KycProfileItem {
  id: string;
  userId: string;
  country: string;
  docType: string;
  docNumber: string;
  status: "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED";
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"users" | "indices" | "countries" | "geoblock" | "kyc" | "contracts" | "audit">("users");
  const [indexStatus, setIndexStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [justification, setJustification] = useState<string>("");

  // Filtros Globais Multi-País da Seção 11.2 (País, Moeda, Status, Data)
  const [filterCountry, setFilterCountry] = useState<string>("ALL");
  const [filterCurrency, setFilterCurrency] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");

  const [usersList, setUsersList] = useState([
    { id: "usr_br_001", email: "trader1@broker.test", status: "ACTIVE", country: "BR", currency: "BRL", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 (R$ 55.000,00)" },
    { id: "usr_mx_002", email: "trader2@broker.test", status: "ACTIVE", country: "MX", currency: "MXN", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 (Mex$ 195.000,00)" },
    { id: "usr_co_003", email: "trader3@broker.test", status: "BLOCKED", country: "CO", currency: "COP", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 (Col$ 41.500.000)" },
    { id: "usr_ar_004", email: "trader4@broker.test", status: "ACTIVE", country: "AR", currency: "ARS", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 ($ 9.800.000,00)" },
    { id: "usr_cl_005", email: "trader5@broker.test", status: "ACTIVE", country: "CL", currency: "CLP", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 (CLP$ 9.400.000)" },
    { id: "usr_pe_006", email: "trader6@broker.test", status: "ACTIVE", country: "PE", currency: "PEN", createdAt: "2026-10-08", demoBalance: "US$ 10.000,00 (S/. 37.500,00)" }
  ]);

  const contractsByCountry = [
    { id: "cnt_901", userId: "usr_br_001", country: "BR", currency: "BRL", symbol: "SYNTH_VOL_50", direction: "UP", stakeMinor: 1000, payoutPct: 85, status: "SETTLED", result: "WIN", date: "2026-10-08" },
    { id: "cnt_902", userId: "usr_mx_002", country: "MX", currency: "MXN", symbol: "BTCUSD_OTC", direction: "DOWN", stakeMinor: 2500, payoutPct: 85, status: "OPEN", result: "PENDING", date: "2026-10-08" },
    { id: "cnt_903", userId: "usr_co_003", country: "CO", currency: "COP", symbol: "EURUSD_OTC", direction: "UP", stakeMinor: 1500, payoutPct: 85, status: "SETTLED", result: "LOSS", date: "2026-10-08" },
    { id: "cnt_904", userId: "usr_ar_004", country: "AR", currency: "ARS", symbol: "ETHUSD_OTC", direction: "UP", stakeMinor: 2000, payoutPct: 85, status: "SETTLED", result: "WIN", date: "2026-10-08" },
    { id: "cnt_905", userId: "usr_cl_005", country: "CL", currency: "CLP", symbol: "XAUUSD_OTC", direction: "DOWN", stakeMinor: 3000, payoutPct: 85, status: "SETTLED", result: "DRAW", date: "2026-10-08" },
    { id: "cnt_906", userId: "usr_pe_006", country: "PE", currency: "PEN", symbol: "BTCUSD_OTC", direction: "UP", stakeMinor: 1200, payoutPct: 85, status: "OPEN", result: "PENDING", date: "2026-10-08" }
  ];

  const ledgerByCurrency = [
    { currency: "BRL", country: "BR", liabilityAccount: "platform:demo:BRL:liability", revenueAccount: "platform:demo:BRL:revenue", payoutAccount: "platform:demo:BRL:payout", balanceFormatted: "R$ 2.200.000,00 (Demo)" },
    { currency: "MXN", country: "MX", liabilityAccount: "platform:demo:MXN:liability", revenueAccount: "platform:demo:MXN:revenue", payoutAccount: "platform:demo:MXN:payout", balanceFormatted: "Mex$ 3.900.000,00 (Demo)" },
    { currency: "COP", country: "CO", liabilityAccount: "platform:demo:COP:liability", revenueAccount: "platform:demo:COP:revenue", payoutAccount: "platform:demo:COP:payout", balanceFormatted: "Col$ 498.000.000 (Demo)" },
    { currency: "ARS", country: "AR", liabilityAccount: "platform:demo:ARS:liability", revenueAccount: "platform:demo:ARS:revenue", payoutAccount: "platform:demo:ARS:payout", balanceFormatted: "$ 98.000.000,00 (Demo)" },
    { currency: "CLP", country: "CL", liabilityAccount: "platform:demo:CLP:liability", revenueAccount: "platform:demo:CLP:revenue", payoutAccount: "platform:demo:CLP:payout", balanceFormatted: "CLP$ 94.000.000 (Demo)" },
    { currency: "PEN", country: "PE", liabilityAccount: "platform:demo:PEN:liability", revenueAccount: "platform:demo:PEN:revenue", payoutAccount: "platform:demo:PEN:payout", balanceFormatted: "S/. 300.000,00 (Demo)" }
  ];

  const alertsByCountry = [
    { id: "alt_br", country: "BR", currency: "BRL", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (18ms p95)", date: "2026-10-08" },
    { id: "alt_mx", country: "MX", currency: "MXN", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (34ms p95)", date: "2026-10-08" },
    { id: "alt_co", country: "CO", currency: "COP", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (29ms p95)", date: "2026-10-08" },
    { id: "alt_ar", country: "AR", currency: "ARS", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (24ms p95)", date: "2026-10-08" },
    { id: "alt_cl", country: "CL", currency: "CLP", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (27ms p95)", date: "2026-10-08" },
    { id: "alt_pe", country: "PE", currency: "PEN", severity: "OK", message: "Feed OTC e Sintético operando nominalmente (31ms p95)", date: "2026-10-08" }
  ];

  // Estado dos 6 Países e suas Feature Flags em Runtime (Fase 2)
  const [countries, setCountries] = useState<CountryAdminItem[]>([
    { code: "BR", name: "Brasil", flagEmoji: "🇧🇷", defaultCurrency: "BRL", defaultLocale: "pt-BR", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true },
    { code: "MX", name: "México", flagEmoji: "🇲🇽", defaultCurrency: "MXN", defaultLocale: "es-MX", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true },
    { code: "CO", name: "Colômbia", flagEmoji: "🇨🇴", defaultCurrency: "COP", defaultLocale: "es-CO", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true },
    { code: "AR", name: "Argentina", flagEmoji: "🇦🇷", defaultCurrency: "ARS", defaultLocale: "es-AR", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true },
    { code: "CL", name: "Chile", flagEmoji: "🇨🇱", defaultCurrency: "CLP", defaultLocale: "es-CL", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true },
    { code: "PE", name: "Peru", flagEmoji: "🇵🇪", defaultCurrency: "PEN", defaultLocale: "es-PE", isActive: true, tradingEnabled: true, otcRealFeed: true, demoWallet: true }
  ]);

  // Logs de Geoblocking em tempo real (Fase 2)
  const [geoblockLogs] = useState<GeoblockLogItem[]>([
    { id: "1", timestamp: "10:42:01", country: "US", maskedIp: "198.51.***.45", reason: "Origem não autorizada na Fase 2", status: 403 },
    { id: "2", timestamp: "10:41:30", country: "FR", maskedIp: "185.12.***.89", reason: "Origem não autorizada na Fase 2", status: 403 },
    { id: "3", timestamp: "10:40:15", country: "DE", maskedIp: "194.88.***.12", reason: "Origem não autorizada na Fase 2", status: 403 },
    { id: "4", timestamp: "10:38:52", country: "GB", maskedIp: "212.58.***.77", reason: "Origem não autorizada na Fase 2", status: 403 }
  ]);

  // Perfis de KYC Preparatórios (Fase 2)
  const [kycProfiles, setKycProfiles] = useState<KycProfileItem[]>([
    { id: "kyc-01", userId: "usr_br_8812", country: "BR", docType: "CPF", docNumber: "123.456.789-00", status: "PENDING" },
    { id: "kyc-02", userId: "usr_mx_3401", country: "MX", docType: "CURP", docNumber: "XAXX010101000", status: "APPROVED" },
    { id: "kyc-03", userId: "usr_co_9122", country: "CO", docType: "CC", docNumber: "1020304050", status: "UNVERIFIED" },
    { id: "kyc-04", userId: "usr_ar_5510", country: "AR", docType: "DNI", docNumber: "38.901.234", status: "PENDING" },
    { id: "kyc-05", userId: "usr_cl_7143", country: "CL", docType: "RUT", docNumber: "18.345.678-9", status: "UNVERIFIED" },
    { id: "kyc-06", userId: "usr_pe_2098", country: "PE", docType: "DNI", docNumber: "74581290", status: "APPROVED" }
  ]);

  // Log de auditoria
  const [auditLogs, setAuditLogs] = useState<Array<{ time: string; action: string; reason: string }>>([
    { time: "2026-10-08 02:00:00", action: "INITIALIZE_PHASE_2", reason: "Ativação regional dos 6 países da América Latina" }
  ]);

  const handleToggleCountryFlag = (countryCode: string, field: "isActive" | "tradingEnabled" | "otcRealFeed" | "demoWallet") => {
    setCountries(prev => prev.map(c => {
      if (c.code === countryCode) {
        const updatedVal = !c[field];
        setAuditLogs(logs => [
          {
            time: new Date().toLocaleTimeString(),
            action: `TOGGLE_FLAG_${countryCode}_${field.toUpperCase()}`,
            reason: `Alteração de flag em runtime para ${updatedVal ? "ATIVO" : "INATIVO"}`
          },
          ...logs
        ]);
        return { ...c, [field]: updatedVal };
      }
      return c;
    }));
  };

  const handleUpdateKycStatus = (id: string, newStatus: "APPROVED" | "REJECTED") => {
    setKycProfiles(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    setAuditLogs(logs => [
      {
        time: new Date().toLocaleTimeString(),
        action: `KYC_STATUS_UPDATE_${id}`,
        reason: `Triagem administrativa de documento: ${newStatus}`
      },
      ...logs
    ]);
  };

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

  const handleToggleBlockUser = (userId: string) => {
    const reasonPrompt = prompt("Justificativa de auditoria para bloqueio/desbloqueio (B-14):");
    if (!reasonPrompt || reasonPrompt.trim().length < 5) {
      alert("A justificativa é obrigatória (mínimo 5 caracteres) para auditoria B-14.");
      return;
    }

    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
        setAuditLogs(logs => [
          {
            time: new Date().toLocaleTimeString(),
            action: nextStatus === "BLOCKED" ? `BLOCK_USER_${userId}` : `UNBLOCK_USER_${userId}`,
            reason: reasonPrompt.trim()
          },
          ...logs
        ]);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const filteredUsers = usersList.filter(u => {
    if (filterCountry !== "ALL" && u.country !== filterCountry) return false;
    if (filterCurrency !== "ALL" && u.currency !== filterCurrency) return false;
    if (filterStatus !== "ALL" && u.status !== filterStatus) return false;
    if (filterDate && !u.createdAt.startsWith(filterDate)) return false;
    return true;
  });

  const filteredContracts = contractsByCountry.filter(c => {
    if (filterCountry !== "ALL" && c.country !== filterCountry) return false;
    if (filterCurrency !== "ALL" && c.currency !== filterCurrency) return false;
    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
    if (filterDate && !c.date.startsWith(filterDate)) return false;
    return true;
  });

  const filteredLedger = ledgerByCurrency.filter(l => {
    if (filterCountry !== "ALL" && l.country !== filterCountry) return false;
    if (filterCurrency !== "ALL" && l.currency !== filterCurrency) return false;
    return true;
  });

  const filteredAlerts = alertsByCountry.filter(a => {
    if (filterCountry !== "ALL" && a.country !== filterCountry) return false;
    if (filterCurrency !== "ALL" && a.currency !== filterCurrency) return false;
    if (filterDate && !a.date.startsWith(filterDate)) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0B0E14", color: "#FFFFFF", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      {/* Banner Global Modo Demo Obrigatório (Seção 4.4, 9.2, 16) */}
      <div
        data-testid="admin-demo-banner"
        style={{
          background: "#101622",
          borderBottom: "1px solid rgba(246, 195, 68, 0.3)",
          color: "#F6C344",
          fontSize: "11px",
          fontWeight: "bold",
          textAlign: "center",
          padding: "5px 16px"
        }}
      >
        🛡️ Modo Demo — sem dinheiro real · Ledger 100% Demo em minor units · payments_enabled: false
      </div>
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
            LATAM<span style={{ color: "#F6C344" }}>ADMIN</span>
          </h2>
          <span style={{ background: "#2B2F3A", fontSize: "11px", padding: "3px 8px", borderRadius: "4px", color: "#F6C344" }}>
            PORTAL MULTI-PAÍS — FASE 2
          </span>
        </div>

        <nav style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("users")}
            style={{
              background: activeTab === "users" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "users" ? "bold" : "normal"
            }}
          >
            👥 Usuários
          </button>
          <button
            onClick={() => setActiveTab("countries")}
            style={{
              background: activeTab === "countries" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "countries" ? "bold" : "normal"
            }}
          >
            🌎 Países & Flags
          </button>
          <button
            onClick={() => setActiveTab("geoblock")}
            style={{
              background: activeTab === "geoblock" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "geoblock" ? "bold" : "normal"
            }}
          >
            🛡️ Geoblocking
          </button>
          <button
            onClick={() => setActiveTab("kyc")}
            style={{
              background: activeTab === "kyc" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "kyc" ? "bold" : "normal"
            }}
          >
            📋 KYC Preparatório
          </button>
          <button
            onClick={() => setActiveTab("indices")}
            style={{
              background: activeTab === "indices" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "indices" ? "bold" : "normal"
            }}
          >
            Ativos OTC & Sintéticos
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            style={{
              background: activeTab === "contracts" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "contracts" ? "bold" : "normal"
            }}
          >
            Risco & Solvência
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            style={{
              background: activeTab === "audit" ? "#2B2F3A" : "transparent",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: activeTab === "audit" ? "bold" : "normal"
            }}
          >
            Auditoria Forense
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main style={{ padding: "24px", flex: 1, maxWidth: "1280px", width: "100%", margin: "0 auto" }}>
        {/* Barra Global de Filtros Multi-País (Seção 11.2: País, Moeda, Status, Data) */}
        <div
          data-testid="admin-multicountry-filters"
          style={{
            background: "#161A25",
            borderRadius: "8px",
            padding: "12px 16px",
            border: "1px solid #2B2F3A",
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold", color: "#F6C344" }}>Filtros Multi-País:</span>
            <label style={{ fontSize: "12px", color: "#9B9FA4", display: "flex", alignItems: "center", gap: "6px" }}>
              País:
              <select
                data-testid="admin-filter-country"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                style={{ background: "#0B0E14", color: "#FFFFFF", border: "1px solid #2B2F3A", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}
              >
                <option value="ALL">Todos (6 Países)</option>
                <option value="BR">Brasil (BR)</option>
                <option value="MX">México (MX)</option>
                <option value="CO">Colômbia (CO)</option>
                <option value="AR">Argentina (AR)</option>
                <option value="CL">Chile (CL)</option>
                <option value="PE">Peru (PE)</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", color: "#9B9FA4", display: "flex", alignItems: "center", gap: "6px" }}>
              Moeda:
              <select
                data-testid="admin-filter-currency"
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                style={{ background: "#0B0E14", color: "#FFFFFF", border: "1px solid #2B2F3A", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}
              >
                <option value="ALL">Todas (6 Moedas)</option>
                <option value="BRL">BRL (R$)</option>
                <option value="MXN">MXN ($)</option>
                <option value="COP">COP ($)</option>
                <option value="ARS">ARS ($)</option>
                <option value="CLP">CLP ($)</option>
                <option value="PEN">PEN (S/)</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", color: "#9B9FA4", display: "flex", alignItems: "center", gap: "6px" }}>
              Status:
              <select
                data-testid="admin-filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ background: "#0B0E14", color: "#FFFFFF", border: "1px solid #2B2F3A", borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="OPEN">OPEN</option>
                <option value="SETTLED_WIN">SETTLED_WIN</option>
                <option value="SETTLED_LOSS">SETTLED_LOSS</option>
                <option value="PENDING">PENDING</option>
                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="FIRING">FIRING</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", color: "#9B9FA4", display: "flex", alignItems: "center", gap: "6px" }}>
              Data:
              <input
                data-testid="admin-filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ background: "#0B0E14", color: "#FFFFFF", border: "1px solid #2B2F3A", borderRadius: "4px", padding: "3px 8px", fontSize: "12px" }}
              />
            </label>
          </div>

          <button
            onClick={() => {
              setFilterCountry("ALL");
              setFilterCurrency("ALL");
              setFilterStatus("ALL");
              setFilterDate("");
            }}
            style={{
              background: "#2B2F3A",
              color: "#FFFFFF",
              border: "none",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Limpar Filtros
          </button>
        </div>
        
        {/* ABA 0: USUÁRIOS E BLOQUEIO (T14) */}
        {activeTab === "users" && (
          <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Gestão e Bloqueio de Usuários por País (T14 / Fase 2)</h3>
                <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                  Auditoria B-14 ativa: toda suspensão exige justificativa técnica registrada no log forense.
                </p>
              </div>
              <span style={{ fontSize: "12px", background: "rgba(246, 195, 68, 0.15)", color: "#F6C344", padding: "4px 8px", borderRadius: "4px" }}>
                Sem edição manual de saldo (I-01)
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px" }}>ID do Usuário</th>
                  <th style={{ padding: "12px 8px" }}>Email</th>
                  <th style={{ padding: "12px 8px" }}>País</th>
                  <th style={{ padding: "12px 8px" }}>Moeda</th>
                  <th style={{ padding: "12px 8px" }}>Saldo Demo (Blnk)</th>
                  <th style={{ padding: "12px 8px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "12px 8px", textAlign: "center" }}>Ação Administrativa</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1E222D" }}>
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#F6C344" }}>{u.id}</td>
                    <td style={{ padding: "12px 8px" }}>{u.email}</td>
                    <td style={{ padding: "12px 8px" }}>{u.country}</td>
                    <td style={{ padding: "12px 8px", color: "#9B9FA4" }}>{u.currency}</td>
                    <td style={{ padding: "12px 8px", fontWeight: "bold", color: "#089981" }}>{u.demoBalance}</td>
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        background: u.status === "ACTIVE" ? "rgba(8, 153, 129, 0.2)" : "rgba(242, 54, 69, 0.2)",
                        color: u.status === "ACTIVE" ? "#089981" : "#F23645"
                      }}>
                        {u.status === "ACTIVE" ? "ATIVO" : "BLOQUEADO"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      <button
                        onClick={() => handleToggleBlockUser(u.id)}
                        style={{
                          background: u.status === "ACTIVE" ? "#F23645" : "#089981",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "11px"
                        }}
                      >
                        {u.status === "ACTIVE" ? "BLOQUEAR USUÁRIO" : "DESBLOQUEAR"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA 1: PAÍSES E FEATURE FLAGS (FASE 2) */}
        {activeTab === "countries" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Gestão dos 6 Países e Feature Flags Dinâmicas (Fase 2)</h3>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Chaveamento instantâneo no Redis & PostgreSQL. Desative ou ative um país ou funcionalidade sem novo deploy.
                  </p>
                </div>
                <span style={{ fontSize: "12px", background: "rgba(8, 153, 129, 0.15)", color: "#089981", padding: "4px 8px", borderRadius: "4px" }}>
                  ● Cache Redis Ativo (&lt; 1ms)
                </span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                    <th style={{ padding: "12px 8px" }}>País</th>
                    <th style={{ padding: "12px 8px" }}>Código</th>
                    <th style={{ padding: "12px 8px" }}>Moeda</th>
                    <th style={{ padding: "12px 8px" }}>Locale</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Status Geral</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Trading UP/DOWN</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Feed OTC Real</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Carteira Demo</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map(c => (
                    <tr key={c.code} style={{ borderBottom: "1px solid #1E222D" }}>
                      <td style={{ padding: "12px 8px", fontWeight: "bold" }}>
                        <span style={{ marginRight: "8px", fontSize: "16px" }}>{c.flagEmoji}</span>
                        {c.name}
                      </td>
                      <td style={{ padding: "12px 8px", color: "#F6C344", fontFamily: "monospace" }}>{c.code}</td>
                      <td style={{ padding: "12px 8px" }}>{c.defaultCurrency}</td>
                      <td style={{ padding: "12px 8px", color: "#9B9FA4" }}>{c.defaultLocale}</td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleCountryFlag(c.code, "isActive")}
                          style={{
                            background: c.isActive ? "rgba(8, 153, 129, 0.2)" : "rgba(242, 54, 69, 0.2)",
                            color: c.isActive ? "#089981" : "#F23645",
                            border: "none",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "11px"
                          }}
                        >
                          {c.isActive ? "HABILITADO" : "BLOQUEADO"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleCountryFlag(c.code, "tradingEnabled")}
                          style={{
                            background: c.tradingEnabled ? "#089981" : "#2B2F3A",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px"
                          }}
                        >
                          {c.tradingEnabled ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleCountryFlag(c.code, "otcRealFeed")}
                          style={{
                            background: c.otcRealFeed ? "#089981" : "#2B2F3A",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px"
                          }}
                        >
                          {c.otcRealFeed ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleCountryFlag(c.code, "demoWallet")}
                          style={{
                            background: c.demoWallet ? "#089981" : "#2B2F3A",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px"
                          }}
                        >
                          {c.demoWallet ? "ON" : "OFF"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Log de Ações Rápidas */}
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "16px", border: "1px solid #2B2F3A" }}>
              <h4 style={{ fontSize: "14px", marginBottom: "12px", color: "#F6C344" }}>Log Recente de Modificação de Flags</h4>
              <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {auditLogs.slice(0, 4).map((log, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#9B9FA4", borderBottom: "1px solid #1E222D", paddingBottom: "4px" }}>
                    <span>[{log.time}] <strong>{log.action}</strong>: {log.reason}</span>
                    <span style={{ color: "#089981" }}>Auditado</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: GEOBLOCKING AUDIT (FASE 2) */}
        {activeTab === "geoblock" && (
          <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Auditoria de Geoblocking em Tempo Real (Fase 2)</h3>
                <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                  Origens fora da América Latina autorizada recebem HTTP 403 GEO_BLOCKED na borda.
                </p>
              </div>
              <span style={{ padding: "4px 8px", background: "rgba(242, 54, 69, 0.15)", color: "#F23645", borderRadius: "4px", fontSize: "12px" }}>
                100% dos Países Não-Autorizados Bloqueados
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Horário</th>
                  <th style={{ padding: "8px" }}>País Detectado</th>
                  <th style={{ padding: "8px" }}>IP Mascarado (LGPD)</th>
                  <th style={{ padding: "8px" }}>Motivo de Bloqueio</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>Status HTTP</th>
                </tr>
              </thead>
              <tbody>
                {geoblockLogs.map(item => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #1E222D" }}>
                    <td style={{ padding: "8px" }}>{item.timestamp}</td>
                    <td style={{ padding: "8px", fontWeight: "bold", color: "#F23645" }}>{item.country}</td>
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>{item.maskedIp}</td>
                    <td style={{ padding: "8px", color: "#9B9FA4" }}>{item.reason}</td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span style={{ padding: "2px 6px", background: "rgba(242, 54, 69, 0.2)", color: "#F23645", borderRadius: "4px", fontWeight: "bold" }}>
                        {item.status} FORBIDDEN
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA 3: KYC PREPARATÓRIO (FASE 2) */}
        {activeTab === "kyc" && (
          <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Triagem de KYC Preparatório por País (Fase 2)</h3>
                <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                  Campos e tabelas preparatórios estruturados. A carteira demo opera livremente sem bloqueio nesta fase.
                </p>
              </div>
              <span style={{ padding: "4px 8px", background: "rgba(246, 195, 68, 0.15)", color: "#F6C344", borderRadius: "4px", fontSize: "12px" }}>
                Zero Dinheiro Real Circulando
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>ID Usuário</th>
                  <th style={{ padding: "8px" }}>País</th>
                  <th style={{ padding: "8px" }}>Tipo Documento</th>
                  <th style={{ padding: "8px" }}>Número</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>Status Atual</th>
                  <th style={{ padding: "8px", textAlign: "center" }}>Ação Administrativa</th>
                </tr>
              </thead>
              <tbody>
                {kycProfiles
                  .filter(item => {
                    if (filterCountry !== "ALL" && item.country !== filterCountry) return false;
                    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
                    return true;
                  })
                  .map(item => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #1E222D" }}>
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>{item.userId}</td>
                    <td style={{ padding: "8px", fontWeight: "bold" }}>{item.country}</td>
                    <td style={{ padding: "8px", color: "#F6C344" }}>{item.docType}</td>
                    <td style={{ padding: "8px" }}>{item.docNumber}</td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        background:
                          item.status === "APPROVED" ? "rgba(8, 153, 129, 0.2)" :
                          item.status === "REJECTED" ? "rgba(242, 54, 69, 0.2)" :
                          "rgba(246, 195, 68, 0.2)",
                        color:
                          item.status === "APPROVED" ? "#089981" :
                          item.status === "REJECTED" ? "#F23645" :
                          "#F6C344"
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "center", display: "flex", gap: "6px", justifyContent: "center" }}>
                      <button
                        onClick={() => handleUpdateKycStatus(item.id, "APPROVED")}
                        style={{ background: "#089981", color: "#FFFFFF", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "10px" }}
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleUpdateKycStatus(item.id, "REJECTED")}
                        style={{ background: "#F23645", color: "#FFFFFF", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "10px" }}
                      >
                        Rejeitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA 4: ATIVOS SINTÉTICOS E OTC (FASE 1 & FASE 2) */}
        {activeTab === "indices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Ativos Sintéticos & OTC Demo com Feed Real</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Ativo Sintético Fase 1 */}
                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "bold" }}>SYNTH_VOL_50</h4>
                    <span style={{
                      fontSize: "11px",
                      color: indexStatus === "ACTIVE" ? "#089981" : "#F23645",
                      background: indexStatus === "ACTIVE" ? "rgba(8, 153, 129, 0.15)" : "rgba(242, 54, 69, 0.15)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold"
                    }}>
                      {indexStatus === "ACTIVE" ? "ATIVO (CSPRNG)" : "PAUSADO (ADMIN)"}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Motor Ornstein-Uhlenbeck puro (Fase 1).
                  </p>
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setShowModal(true)}
                      style={{
                        background: indexStatus === "ACTIVE" ? "rgba(242, 54, 69, 0.2)" : "rgba(8, 153, 129, 0.2)",
                        color: indexStatus === "ACTIVE" ? "#F23645" : "#089981",
                        border: `1px solid ${indexStatus === "ACTIVE" ? "#F23645" : "#089981"}`,
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        cursor: "pointer"
                      }}
                    >
                      {indexStatus === "ACTIVE" ? "PAUSAR ÍNDICE (B-14)" : "RETOMAR ÍNDICE (B-14)"}
                    </button>
                  </div>
                </div>

                {/* Ativos OTC Reais Fase 2 */}
                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "bold" }}>BTCUSD_OTC / ETHUSD_OTC</h4>
                    <span style={{ fontSize: "11px", color: "#F6C344", background: "rgba(246, 195, 68, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                      Feed Real Cripto (Fase 2)
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Circuito fechado, precisão 2 decimais com fallback estocástico.
                  </p>
                </div>

                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "bold" }}>EURUSD_OTC</h4>
                    <span style={{ fontSize: "11px", color: "#F6C344", background: "rgba(246, 195, 68, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                      Feed Real Forex (Fase 2)
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Precisão 5 decimais, fallback Ornstein-Uhlenbeck.
                  </p>
                </div>

                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: "bold" }}>XAUUSD_OTC</h4>
                    <span style={{ fontSize: "11px", color: "#F6C344", background: "rgba(246, 195, 68, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                      Feed Real Ouro (Fase 2)
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9B9FA4", marginTop: "4px" }}>
                    Precisão 2 decimais, cotação viva.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: CONTRATOS POR PAÍS, LEDGER POR MOEDA & RISCO (Seção 11.1) */}
        {activeTab === "contracts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Visão Geral de Ordens e Exposição de Risco Regional</h3>
              <p style={{ fontSize: "13px", color: "#9B9FA4", marginBottom: "20px" }}>
                Monitoramento do Float Cap de solvência (3% máximo) compartilhado entre os 6 países.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Capital Float da Plataforma</span>
                  <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#FFFFFF", marginTop: "4px" }}>US$ 1.000.000,00</h4>
                </div>
                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Teto de Risco por Vela (3%)</span>
                  <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#F6C344", marginTop: "4px" }}>US$ 30.000,00</h4>
                </div>
                <div style={{ background: "#0B0E14", padding: "16px", borderRadius: "6px", border: "1px solid #2B2F3A" }}>
                  <span style={{ fontSize: "12px", color: "#9B9FA4" }}>Payout Fixo Demo</span>
                  <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#089981", marginTop: "4px" }}>85%</h4>
                </div>
              </div>
            </div>

            {/* Contratos por País (Seção 11.1) */}
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
              <h4 style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "12px" }}>Contratos UP/DOWN por País (60s / Payout 85%)</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                    <th style={{ padding: "8px" }}>ID Contrato</th>
                    <th style={{ padding: "8px" }}>País</th>
                    <th style={{ padding: "8px" }}>Moeda</th>
                    <th style={{ padding: "8px" }}>Ativo</th>
                    <th style={{ padding: "8px" }}>Direção</th>
                    <th style={{ padding: "8px" }}>Stake (Minor)</th>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((ct) => (
                    <tr key={ct.id} style={{ borderBottom: "1px solid #1E222D" }}>
                      <td style={{ padding: "8px", fontFamily: "monospace", color: "#F6C344" }}>{ct.id}</td>
                      <td style={{ padding: "8px", fontWeight: "bold" }}>{ct.country}</td>
                      <td style={{ padding: "8px" }}>{ct.currency}</td>
                      <td style={{ padding: "8px" }}>{ct.symbol}</td>
                      <td style={{ padding: "8px", color: ct.direction === "UP" ? "#089981" : "#F23645", fontWeight: "bold" }}>{ct.direction}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace" }}>{ct.stakeMinor}</td>
                      <td style={{ padding: "8px" }}>{ct.status} ({ct.result})</td>
                      <td style={{ padding: "8px", color: "#9B9FA4" }}>{ct.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ledger Demo por Moeda (Seção 7 & 11.1) */}
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
              <h4 style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "12px" }}>Ledger de Dupla Entrada Demo por Moeda (Blnk)</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                    <th style={{ padding: "8px" }}>País</th>
                    <th style={{ padding: "8px" }}>Moeda</th>
                    <th style={{ padding: "8px" }}>Saldo Consolidado</th>
                    <th style={{ padding: "8px" }}>Platform Liability</th>
                    <th style={{ padding: "8px" }}>Platform Revenue</th>
                    <th style={{ padding: "8px" }}>Platform Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((lg) => (
                    <tr key={lg.currency} style={{ borderBottom: "1px solid #1E222D" }}>
                      <td style={{ padding: "8px", fontWeight: "bold" }}>{lg.country}</td>
                      <td style={{ padding: "8px", color: "#F6C344", fontWeight: "bold" }}>{lg.currency}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace", color: "#089981" }}>{lg.balanceFormatted}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace" }}>{lg.liabilityAccount}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace", color: "#089981" }}>{lg.revenueAccount}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace", color: "#F23645" }}>{lg.payoutAccount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 6: AUDITORIA FORENSE & ALERTAS POR PAÍS (Seção 11.1 & 12.2) */}
        {activeTab === "audit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px", border: "1px solid #2B2F3A" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Alertas Operacionais por País (Seção 11.1 & 12.2)</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "#9B9FA4", borderBottom: "1px solid #2B2F3A", textAlign: "left" }}>
                    <th style={{ padding: "8px" }}>ID Alerta</th>
                    <th style={{ padding: "8px" }}>País</th>
                    <th style={{ padding: "8px" }}>Moeda</th>
                    <th style={{ padding: "8px" }}>Severidade</th>
                    <th style={{ padding: "8px" }}>Mensagem / Regra</th>
                    <th style={{ padding: "8px" }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((al) => (
                    <tr key={al.id} style={{ borderBottom: "1px solid #1E222D" }}>
                      <td style={{ padding: "8px", fontFamily: "monospace" }}>{al.id}</td>
                      <td style={{ padding: "8px", fontWeight: "bold", color: "#F6C344" }}>{al.country}</td>
                      <td style={{ padding: "8px" }}>{al.currency}</td>
                      <td style={{ padding: "8px", color: al.severity === "CRITICAL" ? "#F23645" : "#F6C344", fontWeight: "bold" }}>{al.severity}</td>
                      <td style={{ padding: "8px" }}>{al.message}</td>
                      <td style={{ padding: "8px", color: "#9B9FA4" }}>{al.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#161A25", borderRadius: "8px", padding: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Auditoria Forense & Invariantes Invioláveis</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                  ✓ [I-01 / I-02] Partidas Dobradas: Moedas de exibição não afetam o ledger (100% minor units).
                </li>
                <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                  ✓ [S-04] Geoblocking Inviolável: 100% de conexões fora de BR, MX, CO, AR, CL, PE interceptadas.
                </li>
                <li style={{ padding: "10px", background: "#0B0E14", borderRadius: "6px", border: "1px solid #089981", color: "#089981" }}>
                  ✓ [D-09] Conexão Única & Feeds Reais: Circuit Breaker impede congelamento de ativos OTC demo.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE JUSTIFICATIVA B-14 PARA PAUSA DE ÍNDICE */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#161A25",
            border: "1px solid #2B2F3A",
            borderRadius: "8px",
            padding: "24px",
            maxWidth: "460px",
            width: "90%"
          }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px", color: "#F6C344" }}>
              Auditoria de Segurança B-14 — Justificativa Obrigatória
            </h3>
            <p style={{ fontSize: "12px", color: "#9B9FA4", marginBottom: "16px" }}>
              Toda interrupção ou retomada de motor de preços requer motivo técnico auditado registrado no log forense.
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva detalhadamente a justificativa técnica para auditoria..."
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0B0E14",
                border: "1px solid #2B2F3A",
                color: "#FFFFFF",
                borderRadius: "6px",
                padding: "8px",
                fontSize: "12px",
                marginBottom: "16px",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => { setShowModal(false); setJustification(""); }}
                style={{
                  background: "#2B2F3A",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleIndex}
                style={{
                  background: indexStatus === "ACTIVE" ? "#F23645" : "#089981",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                Confirmar Operação Auditada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
