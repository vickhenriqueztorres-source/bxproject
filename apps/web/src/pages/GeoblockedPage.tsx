import React from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { useTranslation } from '../i18n';

export function GeoblockedPage() {
  const { t } = useTranslation();

  return (
    <SecondaryLayout showRiskDisclaimer={true}>
      <div
        data-testid="geoblocked-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '65vh',
          textAlign: 'center',
          padding: '24px 16px',
        }}
      >
        {/* Ícone de Borda / Escudo Geográfico */}
        <div
          style={{
            width: '260px',
            height: '140px',
            backgroundColor: '#111A2B',
            border: '1px solid #1F2A3A',
            borderRadius: '10px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '24px',
              borderBottom: '1px solid #1F2A3A',
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              gap: '6px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8A96A8' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
          </div>

          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              color: '#EF4444',
            }}
          >
            🌐
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: '12px',
            letterSpacing: '0.15em',
            color: '#8A96A8',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          {t("geoblock.title")}
        </div>

        {/* Título Principal */}
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 800,
            margin: '0 0 16px',
            color: '#E6EDF5',
            letterSpacing: '-0.02em',
          }}
        >
          {t("geoblock.title")}
        </h1>

        {/* Mensagem explicativa */}
        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#8A96A8',
            maxWidth: '560px',
            margin: '0 0 24px',
          }}
        >
          {t("geoblock.message")}
        </p>

        {/* Lista dos 6 Países */}
        <div
          style={{
            backgroundColor: '#111A2B',
            border: '1px solid #1F2A3A',
            borderRadius: '8px',
            padding: '16px 24px',
            marginBottom: '24px',
            color: '#22C55E',
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '0.02em',
          }}
        >
          {t("geoblock.countries")}
        </div>

        {/* Aviso de VPN / Suporte */}
        <div
          style={{
            fontSize: '13px',
            color: '#64748B',
            maxWidth: '480px',
            lineHeight: 1.5,
            marginBottom: '28px',
          }}
        >
          {t("geoblock.support")}
        </div>

        {/* Botão de Tentar Novamente */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#22C55E',
            color: '#0B0E14',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16A34A')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22C55E')}
        >
          {t("geoblock.button_retry")}
        </button>
      </div>
    </SecondaryLayout>
  );
}
