import React, { useState } from 'react';

interface ScreenItem {
  id: string;
  name: string;
  category: 'Público' | 'Autenticación' | 'Operación' | 'Cuenta' | 'Engajamento' | 'Sistema';
  path: string;
  badge: string;
  description: string;
}

const SCREENS: ScreenItem[] = [
  {
    id: 'landing',
    name: 'Landing Pública Oficial',
    category: 'Público',
    path: '/landing',
    badge: 'CONVERSIÓN',
    description: 'Hero con copy de alta conversión, live preview del Vol 50 a 60 FPS, beneficios, activos populares y FAQ.',
  },
  {
    id: 'traderoom',
    name: 'Sala de Trading (Traderoom)',
    category: 'Operación',
    path: '/operar',
    badge: 'CORE TRADING',
    description: 'Terminal completa con gráficos múltiples, boleta de 60s, traders mood bar, dock inferior y draw-tools.',
  },
  {
    id: 'login',
    name: 'Iniciar Sesión',
    category: 'Autenticación',
    path: '/login',
    badge: '55/45 SPLIT',
    description: 'Split-screen con live chart silencioso del Vol 50 a la izquierda y protección anti-brute force a la derecha.',
  },
  {
    id: 'registro',
    name: 'Crear Cuenta Demo',
    category: 'Autenticación',
    path: '/registro',
    badge: 'ONBOARDING',
    description: 'Formulario en etapa única con selector de países con banderas y asignación inmediata de $10.000 demo.',
  },
  {
    id: 'recuperar',
    name: 'Recuperar Contraseña',
    category: 'Autenticación',
    path: '/recuperar',
    badge: 'SEGURIDAD',
    description: 'Card centralizado de 420px con temporizador de expiración de 15 minutos y redefinición segura.',
  },
  {
    id: 'deposito',
    name: 'Cajero: Depósito',
    category: 'Cuenta',
    path: '/deposito',
    badge: 'PIX / TARJETA / USDT',
    description: 'Modal de 520px con chips rápidos de $20-$500, bono del +30% y pantalla 2 PIX con QR Code dinámico.',
  },
  {
    id: 'retiro',
    name: 'Cajero: Retiro',
    category: 'Cuenta',
    path: '/retiro',
    badge: 'FINANZAS',
    description: 'Verificación de saldo disponible, monto mínimo $50, alerta KYC y tarjeta de estado en revisión.',
  },
  {
    id: 'verificacion',
    name: 'Verificación KYC',
    category: 'Cuenta',
    path: '/verificacion',
    badge: 'COMPLIANCE',
    description: '3 pasos visuales con drag & drop de documentos, barra de progreso al 35% y motivos de rechazo claros.',
  },
  {
    id: 'ajustes',
    name: 'Ajustes y Seguridad',
    category: 'Cuenta',
    path: '/ajustes',
    badge: '2FA & PERFIL',
    description: 'Sidebar interna con 5 tarjetas modulares: Perfil, 2FA y cierre de sesiones activas, Operación e Idioma.',
  },
  {
    id: 'historial',
    name: 'Historial de Operaciones',
    category: 'Operación',
    path: '/historial',
    badge: 'EXTRACTO RFC-4180',
    description: 'Tabela de auditoría con filtros por período, activo y resultado, chips SUBE/BAJA y exportación a CSV.',
  },
  {
    id: 'torneos',
    name: 'Torneos de Trading',
    category: 'Engajamento',
    path: '/torneos',
    badge: 'LEADERBOARD',
    description: 'Cards con premios y cuenta regresiva, reglas oficiales, posición del usuario fijada #1 y escala de premios.',
  },
  {
    id: 'analisis',
    name: 'Análisis y Métricas',
    category: 'Engajamento',
    path: '/analisis',
    badge: 'ESTADÍSTICAS',
    description: 'Tasa de acierto 68.2%, barras de ganancias diarias, rendimiento por activo y gráfico donut de resultados.',
  },
  {
    id: 'tutoriales',
    name: 'Academia y Tutoriales',
    category: 'Engajamento',
    path: '/tutoriales',
    badge: 'VIDEO PLAYER',
    description: 'Buscador por tema, chips de categorías, aula destacada y modal interactivo de reproducción de vídeo.',
  },
  {
    id: 'promociones',
    name: 'Promociones y Bonos',
    category: 'Engajamento',
    path: '/promociones',
    badge: 'JUEGO LIMPIO',
    description: 'Cards sobrios y transparentes de bienvenida, 10% de cashback y sello de transparencia sin letras chicas.',
  },
  {
    id: 'mantenimiento',
    name: 'Modo Mantenimiento',
    category: 'Sistema',
    path: '/mantenimiento',
    badge: 'SISTEMA',
    description: 'Pantalla de contingencia con reloj regresivo oficial (UTC-3), logo de marca y contacto de soporte.',
  },
  {
    id: 'notfound',
    name: 'Página 404',
    category: 'Sistema',
    path: '/pagina-inexistente',
    badge: 'ERROR 404',
    description: 'Página de error elegante con botones directos para retornar a la operativa en la sala.',
  },
];

export function PreviewHubPage() {
  const [selectedScreen, setSelectedScreen] = useState<ScreenItem>(SCREENS[0]);
  const [viewMode, setViewMode] = useState<'preview' | 'grid'>('preview');
  const [deviceWidth, setDeviceWidth] = useState<'100%' | '1200px' | '768px' | '375px'>('100%');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070B14',
        color: '#E6EDF5',
        fontFamily: "'Geist', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── TOPO DO HUB DE PREVIEWS ───────────────────────────────── */}
      <header
        style={{
          background: '#0B1220',
          borderBottom: '1px solid #1F2A3A',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#22C55E', fontSize: '22px', fontWeight: 900 }}>∿</span>
            <strong style={{ fontSize: '16px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.04em' }}>
              BINMAX
            </strong>
            <span
              style={{
                background: '#22C55E',
                color: '#0B1220',
                fontSize: '10px',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              PREVIEW HUB
            </span>
          </div>
          <span style={{ color: '#8A96A8', fontSize: '12px' }}>
            16 pantallas oficiales 100% operativas
          </span>
        </div>

        {/* Controles Centrais */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Alternador de Modo: Iframe vs Grid */}
          <div style={{ display: 'flex', background: '#111A2B', border: '1px solid #1F2A3A', borderRadius: '6px', padding: '3px' }}>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              style={{
                background: viewMode === 'preview' ? '#1F2A3A' : 'transparent',
                color: viewMode === 'preview' ? '#22C55E' : '#8A96A8',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🖥️ Visor en Vivo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? '#1F2A3A' : 'transparent',
                color: viewMode === 'grid' ? '#22C55E' : '#8A96A8',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📑 Galería (16)
            </button>
          </div>

          {/* Emuladores de Dispositivo quando no Visor */}
          {viewMode === 'preview' && (
            <div style={{ display: 'flex', background: '#111A2B', border: '1px solid #1F2A3A', borderRadius: '6px', padding: '3px' }}>
              {[
                { label: 'Auto', w: '100%' },
                { label: 'Desktop (1200px)', w: '1200px' },
                { label: 'Tablet (768px)', w: '768px' },
                { label: 'Móvil (375px)', w: '375px' },
              ].map((d) => (
                <button
                  key={d.w}
                  type="button"
                  onClick={() => setDeviceWidth(d.w as any)}
                  style={{
                    background: deviceWidth === d.w ? '#1F2A3A' : 'transparent',
                    color: deviceWidth === d.w ? '#22C55E' : '#8A96A8',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Link Externo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href={selectedScreen.path}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#22C55E',
              color: '#0B1220',
              textDecoration: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Abrir en pestaña nueva</span>
            <span>↗</span>
          </a>
        </div>
      </header>

      {/* ─── BARRA DE ROLAGEM HORIZONTAL DE TELAS ───────────────────── */}
      <div
        style={{
          background: '#0B1220',
          borderBottom: '1px solid #1F2A3A',
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'thin',
        }}
      >
        {SCREENS.map((s) => {
          const isSelected = s.id === selectedScreen.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedScreen(s);
                setViewMode('preview');
              }}
              style={{
                background: isSelected ? '#1F2A3A' : '#111A2B',
                color: isSelected ? '#22C55E' : '#8A96A8',
                border: isSelected ? '1px solid #22C55E' : '1px solid #1F2A3A',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <span>{s.name}</span>
              <span
                style={{
                  fontSize: '9px',
                  background: isSelected ? '#22C55E' : '#1F2A3A',
                  color: isSelected ? '#0B1220' : '#8A96A8',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontWeight: 800,
                }}
              >
                {s.path}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'preview' ? (
          /* MODO VISOR EM VIVO (IFRAME RESPONSIVO) */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#070B14',
              padding: '16px',
            }}
          >
            {/* Informações da Tela Selecionada */}
            <div
              style={{
                width: '100%',
                maxWidth: deviceWidth,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                padding: '0 4px',
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', color: '#E6EDF5' }}>
                  {selectedScreen.name}
                </strong>
                <span style={{ fontSize: '11.5px', color: '#8A96A8', marginLeft: '10px' }}>
                  {selectedScreen.description}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#22C55E', fontFamily: "'Geist Mono', monospace" }}>
                Ruta: {selectedScreen.path}
              </span>
            </div>

            {/* Container do Iframe */}
            <div
              style={{
                width: deviceWidth,
                maxWidth: '100%',
                height: 'calc(100vh - 170px)',
                background: '#0B1220',
                border: '1px solid #1F2A3A',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                transition: 'width 0.2s ease',
              }}
            >
              <iframe
                title={selectedScreen.name}
                src={selectedScreen.path}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#0B1220',
                }}
              />
            </div>
          </div>
        ) : (
          /* MODO GALERIA EM GRADE (TODAS AS 16 TELAS) */
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#E6EDF5', margin: '0 0 6px' }}>
                Catálogo de Pantallas de la Plataforma BINMAX
              </h2>
              <p style={{ fontSize: '13px', color: '#8A96A8', margin: 0 }}>
                Selecciona cualquier pantalla para visualizarla en el visor integrado o ábrela en una pestaña individual.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {SCREENS.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: '#111A2B',
                    border: '1px solid #1F2A3A',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span
                        style={{
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#22C55E',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {s.category}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8A96A8', fontFamily: "'Geist Mono', monospace" }}>
                        {s.path}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#E6EDF5', margin: '0 0 8px' }}>
                      {s.name}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#8A96A8', margin: 0, lineHeight: 1.5 }}>
                      {s.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScreen(s);
                        setViewMode('preview');
                      }}
                      style={{
                        flex: 1,
                        background: '#1F2A3A',
                        color: '#E6EDF5',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver en visor
                    </button>
                    <a
                      href={s.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: '#22C55E',
                        color: '#0B1220',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
