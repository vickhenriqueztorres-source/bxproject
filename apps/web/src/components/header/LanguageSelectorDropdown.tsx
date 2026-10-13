import React, { useState, useRef, useEffect } from "react";
import { useTranslation, Locale } from "../../i18n";

export interface LanguageOption {
  code: Locale;
  label: string;
  country: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "pt-BR", label: "Português", country: "Brasil", flag: "🇧🇷" },
  { code: "es-MX", label: "Español", country: "México", flag: "🇲🇽" },
  { code: "es-CO", label: "Español", country: "Colombia", flag: "🇨🇴" },
  { code: "es-AR", label: "Español", country: "Argentina", flag: "🇦🇷" },
  { code: "es-CL", label: "Español", country: "Chile", flag: "🇨🇱" },
  { code: "es-PE", label: "Español", country: "Perú", flag: "🇵🇪" },
];

export const LanguageSelectorDropdown: React.FC = () => {
  const { locale, setLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === locale) || LANGUAGE_OPTIONS[0];

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="header-language-selector"
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        data-testid="language-dropdown-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(16, 26, 47, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "6px",
          padding: "5px 9px",
          color: "#E6EDF5",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          outline: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.4)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)")}
        title={`Idioma: ${currentOption.label} (${currentOption.country})`}
      >
        <span style={{ fontSize: "14px", lineHeight: 1 }}>{currentOption.flag}</span>
        <span style={{ fontFamily: "'Geist', sans-serif" }}>
          {currentOption.code.startsWith("pt") ? "PT" : "ES"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            color: "#8A92A1",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          data-testid="language-dropdown-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            backgroundColor: "#151D2B",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "4px",
            minWidth: "170px",
            zIndex: 1000,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = opt.code === locale;
            return (
              <button
                key={opt.code}
                type="button"
                data-testid={`language-option-${opt.code}`}
                onClick={() => {
                  setLocale(opt.code);
                  setIsOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 10px",
                  background: isSelected ? "rgba(34, 197, 94, 0.12)" : "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: isSelected ? "#22C55E" : "#E6EDF5",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>{opt.flag}</span>
                  <span>{opt.label}</span>
                  <span style={{ fontSize: "11px", color: "#8A92A1" }}>({opt.country})</span>
                </div>
                {isSelected && (
                  <span style={{ color: "#22C55E", fontSize: "12px", fontWeight: 800 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
