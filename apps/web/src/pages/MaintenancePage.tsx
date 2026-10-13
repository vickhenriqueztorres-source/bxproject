import React from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';

export function MaintenancePage() {
  return (
    <SecondaryLayout showRiskDisclaimer={true}>
      <div
        data-testid="maintenance-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '65vh',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        {/* Ilustração Técnica com Engrenagem e Gráfico */}
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
          {/* Header da mini-janela */}
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
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8A96A8' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
          </div>

          {/* Engrenagem girando sutilmente */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '4px dashed #22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: '#22C55E',
              animation: 'spin 12s linear infinite',
            }}
          >
            ⚙️
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
          Mantenimiento programado
        </div>

        {/* Título Principal */}
        <h1
          style={{
            fontSize: '44px',
            fontWeight: 800,
            margin: '0 0 16px',
            color: '#E6EDF5',
            letterSpacing: '-0.02em',
          }}
        >
          Volvemos <span style={{ color: '#22C55E' }}>en breve</span>
        </h1>

        {/* Parágrafo explicativo */}
        <p
          style={{
            fontSize: '16px',
            lineHeight: 1.6,
            color: '#8A96A8',
            maxWidth: '560px',
            margin: '0 0 32px',
          }}
        >
          La plataforma de BINMAX se encuentra actualmente en mantenimiento programado para seguir brindándote un servicio más rápido, estable y seguro.
        </p>

        {/* Caixa com Hora Prevista de Retorno (UTC-3) */}
        <div
          style={{
            backgroundColor: '#111A2B',
            border: '1px solid #1F2A3A',
            borderRadius: '8px',
            padding: '16px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22C55E',
              fontSize: '20px',
            }}
          >
            🕒
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '12px', color: '#8A96A8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hora prevista de retorno
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#E6EDF5',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              23:30 (UTC-3)
            </div>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', lineHeight: 1.5, marginBottom: '24px' }}>
          Durante este período, algunas funciones pueden no estar disponibles. Agradecemos tu comprensión.
        </div>

        {/* Link de Suporte */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#8A96A8' }}>
          <span>¿Necesitas ayuda?</span>
          <a
            href="mailto:soporte@binmax.com"
            style={{
              color: '#22C55E',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>Contacta a nuestro equipo de soporte</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </SecondaryLayout>
  );
}
