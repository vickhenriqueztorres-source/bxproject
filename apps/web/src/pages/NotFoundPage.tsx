import React from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { useRouter } from '../router/RouterContext';

export function NotFoundPage() {
  const { navigate } = useRouter();

  return (
    <SecondaryLayout>
      <div
        data-testid="not-found-page"
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
        {/* Arte Gráfica 404 Estilizada */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '140px',
              fontWeight: 900,
              fontFamily: "'Geist Mono', monospace",
              color: 'transparent',
              WebkitTextStroke: '2px #1E3A2F',
              letterSpacing: '12px',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            404
          </div>
          {/* Caixa Central com Lupa */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90px',
              height: '75px',
              backgroundColor: '#111A2B',
              border: '2px solid #22C55E',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(34, 197, 94, 0.25)',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: '4px',
                padding: '4px 8px',
                boxSizing: 'border-box',
                borderBottom: '1px solid #1F2A3A',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EAB308' }} />
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8A96A8',
                fontSize: '22px',
                fontWeight: 700,
              }}
            >
              🔍
            </div>
          </div>
        </div>

        {/* Título e Textos em Espanhol */}
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 800,
            margin: '0 0 16px',
            color: '#E6EDF5',
            letterSpacing: '-0.02em',
          }}
        >
          Página <span style={{ color: '#22C55E' }}>no encontrada</span>
        </h1>
        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#8A96A8',
            maxWidth: '520px',
            margin: '0 0 32px',
          }}
        >
          La página que buscas no existe, ha sido movida o ya no está disponible.
          Puede que el enlace esté desactualizado o que hayas escrito la dirección incorrectamente.
        </p>

        {/* Botão de Ação Principal e Link */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => navigate('/operar')}
            style={{
              backgroundColor: '#22C55E',
              color: '#08140B',
              border: 'none',
              padding: '14px 36px',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>Ir a operar</span>
            <span>→</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#8A96A8',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </SecondaryLayout>
  );
}
