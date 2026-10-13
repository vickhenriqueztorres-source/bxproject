import React, { useState, useMemo } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';

export interface TutorialLesson {
  id: string;
  title: string;
  category: 'Principiantes' | 'Plataforma' | 'Estrategias' | 'Gestión de riesgo';
  duration: string;
  description: string;
  level: 'Básico' | 'Intermedio' | 'Avanzado';
}

const LESSONS: TutorialLesson[] = [
  {
    id: 'lesson-01',
    title: 'Cómo hacer tu primera operación',
    category: 'Principiantes',
    duration: '03:24',
    description: 'Guía paso a paso para seleccionar un activo sintético continuo, fijar stake determinístico, definir tiempo de expiración y ejecutar SUBE o BAJA con confirmación server-side.',
    level: 'Básico',
  },
  {
    id: 'lesson-02',
    title: 'Entendiendo las velas japonesas y temporalidades',
    category: 'Principiantes',
    duration: '02:18',
    description: 'Análisis de cuerpo, sombras y volatilidade instantánea en velas japonesas de 5s, 1m y 15m sin retraso de renderizado.',
    level: 'Básico',
  },
  {
    id: 'lesson-03',
    title: 'Gestión de banca: la regla del 2%',
    category: 'Gestión de riesgo',
    duration: '03:02',
    description: 'Preservación de liquidez. Dimensionamiento del stake máximo respecto a la reserva disponible para eliminar el riesgo de ruina.',
    level: 'Avanzado',
  },
  {
    id: 'lesson-04',
    title: 'Mapeo de Soportes y Resistencias Algorítmicas',
    category: 'Estrategias',
    duration: '02:45',
    description: 'Identificación de niveles de inflexión y canales de reversión en índices sintéticos estocásticos Ornstein-Uhlenbeck.',
    level: 'Intermedio',
  },
  {
    id: 'lesson-05',
    title: 'Reversión a la Media con Oscilador RSI Suavizado',
    category: 'Estrategias',
    duration: '03:10',
    description: 'Detección de regímenes de sobrecompra (>70) y sobreventa (<30) para anticipar giros estadísticos de corto plazo.',
    level: 'Intermedio',
  },
  {
    id: 'lesson-06',
    title: 'Fondeo y Retiros Vía Protocolos Instantáneos',
    category: 'Plataforma',
    duration: '02:35',
    description: 'Procedimiento de fondeo mediante PIX y USDT sin fricción, junto con las auditorías de liquidación en menos de 24 horas.',
    level: 'Básico',
  },
  {
    id: 'lesson-07',
    title: 'Lectura de Telemetría y Traders Mood Bar',
    category: 'Plataforma',
    duration: '03:41',
    description: 'Interpretación en tiempo real del flujo agregado de órdenes y correlación con el tick feed oficial.',
    level: 'Intermedio',
  },
];

export function TutorialsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeVideo, setActiveVideo] = useState<TutorialLesson | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const filteredLessons = useMemo(() => {
    return LESSONS.filter((lesson) => {
      const matchesCat = selectedCategory === 'ALL' || lesson.category === selectedCategory;
      const matchesSearch =
        lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lesson.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [searchTerm, selectedCategory]);

  const featured = LESSONS[0];

  return (
    <SecondaryLayout activeNav="Tutoriales">
      <div
        data-testid="tutorials-page-container"
        className="bm-page-enter"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* ─── CABEÇALHO TÉCNICO DA ACADEMIA ──────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: PRECISION_COLORS.metal,
              }}
            >
              Academia Institucional
            </span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>·</span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }}>
              7 Módulos de Entrenamiento
            </span>
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: PRECISION_TEXT.strong,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Tutoriales y Academia de Trading
          </h1>
          <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, margin: '6px 0 0', maxWidth: '700px' }}>
            Capacitación estructurada en microestructura de mercado, gestión cuantitativa de banca y ejecución táctica en terminales de alta velocidad.
          </p>
        </div>

        {/* ─── BARRA DE BUSCA E FILTROS COMPACTOS ─────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
            <input
              type="text"
              data-testid="search-tutorials-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por módulo, activo o indicador técnico..."
              style={{
                width: '100%',
                background: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '6px',
                padding: '9px 14px 9px 36px',
                fontSize: '12.5px',
                color: PRECISION_TEXT.strong,
                outline: 'none',
                boxSizing: 'border-box',
                transition: `border-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PRECISION_TEXT.quiet}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', top: '12px' }}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Chips de Categoria Sem Neon */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'Principiantes', label: 'Fundamentos' },
              { id: 'Plataforma', label: 'Terminal' },
              { id: 'Estrategias', label: 'Estrategias' },
              { id: 'Gestión de riesgo', label: 'Gestión de Riesgo' },
            ].map((c) => {
              const isSelected = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`category-chip-${c.id}`}
                  onClick={() => setSelectedCategory(c.id)}
                  className="bm-btn-press"
                  style={{
                    background: isSelected ? PRECISION_SURFACES.bg3 : PRECISION_SURFACES.bg1,
                    color: isSelected ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.2)' : PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── LEÇÃO PRINCIPAL EM DESTAQUE (HUD DE PRECISÃO CINEMATOGRÁFICO) */}
        {selectedCategory === 'ALL' && !searchTerm && (
          <div
            data-testid="featured-tutorial-card"
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '32px',
              alignItems: 'center',
              marginBottom: '36px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span
                  style={{
                    background: PRECISION_SURFACES.bg3,
                    color: PRECISION_COLORS.metal,
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    border: `1px solid ${PRECISION_SURFACES.line}`,
                  }}
                >
                  Módulo Fundamental 01
                </span>
                <span style={{ fontSize: '12px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  {featured.duration}
                </span>
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: PRECISION_TEXT.strong,
                  margin: '0 0 10px',
                  letterSpacing: '-0.01em',
                }}
              >
                {featured.title}
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: PRECISION_TEXT.muted,
                  lineHeight: 1.6,
                  margin: '0 0 20px',
                }}
              >
                {featured.description}
              </p>

              {/* Botão de Reprodução Sóbrio e Metálico */}
              <button
                type="button"
                data-testid="watch-featured-btn"
                className="bm-btn-precision"
                onClick={() => {
                  setActiveVideo(featured);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Reproducir lección técnica</span>
              </button>
            </div>

            {/* Frame Cinematográfico 16:9 */}
            <div
              onClick={() => {
                setActiveVideo(featured);
                setIsPlaying(true);
              }}
              style={{
                backgroundColor: PRECISION_SURFACES.bg0,
                borderRadius: '6px',
                aspectRatio: '16 / 9',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                border: `1px solid ${PRECISION_SURFACES.line}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Moldura de retículo e telemetria */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'radial-gradient(circle at center, rgba(34, 196, 122, 0.05) 0%, transparent 70%)',
                }}
              />
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(21, 29, 43, 0.9)',
                  border: `1px solid rgba(255, 255, 255, 0.2)`,
                  color: PRECISION_TEXT.strong,
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 2,
                  transition: `transform ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '12px',
                  background: 'rgba(11, 14, 20, 0.85)',
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: PRECISION_TEXT.strong,
                  fontFamily: PRECISION_FONTS.mono,
                }}
                className="bm-tabular-nums"
              >
                {featured.duration}
              </div>
            </div>
          </div>
        )}

        {/* ─── ESTEIRA EDITORIAL DE LEÇÕES (LISTA INDEXADA DE PRECISÃO) ─── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: 0 }}>
              {selectedCategory === 'ALL' ? 'Programa Curricular Completo' : `Módulo: ${selectedCategory}`}
            </h3>
            <span style={{ fontSize: '12px', color: PRECISION_TEXT.quiet, fontFamily: PRECISION_FONTS.mono }}>
              {filteredLessons.length} lecciones disponibles
            </span>
          </div>

          {filteredLessons.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                color: PRECISION_TEXT.muted,
                background: PRECISION_SURFACES.bg1,
                borderRadius: '8px',
                border: `1px solid ${PRECISION_SURFACES.line}`,
              }}
            >
              No se encontraron tutoriales bajo los parámetros indicados.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {filteredLessons.map((l, index) => (
                <div
                  key={l.id}
                  data-testid={`tutorial-card-${l.id}`}
                  onClick={() => {
                    setActiveVideo(l);
                    setIsPlaying(true);
                  }}
                  style={{
                    backgroundColor: PRECISION_SURFACES.bg1,
                    border: `1px solid ${PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: PRECISION_TEXT.quiet,
                        fontFamily: PRECISION_FONTS.mono,
                        width: '24px',
                      }}
                      className="bm-tabular-nums"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            color: PRECISION_COLORS.metal,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                          }}
                        >
                          {l.category}
                        </span>
                        <span style={{ fontSize: '10px', color: PRECISION_TEXT.quiet }}>·</span>
                        <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>
                          {l.level}
                        </span>
                      </div>
                      <h4
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: PRECISION_TEXT.strong,
                          margin: '0 0 4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {l.title}
                      </h4>
                      <p
                        style={{
                          fontSize: '12px',
                          color: PRECISION_TEXT.muted,
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '780px',
                        }}
                      >
                        {l.description}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginLeft: '16px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: PRECISION_TEXT.muted,
                        fontFamily: PRECISION_FONTS.mono,
                      }}
                      className="bm-tabular-nums"
                    >
                      {l.duration}
                    </span>
                    <span
                      style={{
                        color: PRECISION_TEXT.strong,
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Ver clase →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── MODAL REPRODUTOR DE LEÇÃO (HUD SUÍÇO COM ESCALA EM --t-base) ── */}
        {activeVideo && (
          <div
            data-testid="tutorial-video-modal"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(11, 14, 20, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'grid',
              placeItems: 'center',
              padding: '16px',
            }}
          >
            <div
              className="bm-modal-scale"
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '8px',
                width: '100%',
                maxWidth: '720px',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
              }}
            >
              {/* Header do Player */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: PRECISION_COLORS.metal, fontWeight: 600, textTransform: 'uppercase' }}>
                    {activeVideo.category} · {activeVideo.level}
                  </span>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '2px 0 0' }}>
                    {activeVideo.title}
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="close-video-modal-btn"
                  onClick={() => setActiveVideo(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: PRECISION_TEXT.muted,
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Área do Player de Vídeo */}
              <div
                style={{
                  height: '340px',
                  backgroundColor: PRECISION_SURFACES.bg0,
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: PRECISION_SURFACES.bg2,
                      border: `1px solid rgba(255, 255, 255, 0.15)`,
                      color: PRECISION_TEXT.strong,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '16px',
                      margin: '0 auto 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {isPlaying ? '❚❚' : '▶'}
                  </div>
                  <span style={{ fontSize: '12.5px', color: PRECISION_TEXT.muted, fontWeight: 500 }}>
                    {isPlaying ? 'Reproduciendo instrucción técnica...' : 'Pausado'}
                  </span>
                </div>

                {/* Barra de Controles Inferior */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(11, 14, 20, 0.95), transparent)',
                    padding: '12px 18px',
                  }}
                >
                  {/* Scrub Bar */}
                  <div style={{ height: '3px', background: PRECISION_SURFACES.bg3, borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ width: '45%', height: '100%', background: PRECISION_COLORS.profit }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: PRECISION_TEXT.strong }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        style={{ background: 'transparent', border: 'none', color: PRECISION_TEXT.strong, cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                      >
                        {isPlaying ? 'Pausar' : 'Reproducir'}
                      </button>
                      <span style={{ color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                        01:15 / {activeVideo.duration}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: PRECISION_TEXT.quiet, fontSize: '11px', fontFamily: PRECISION_FONTS.mono }}>1080p · 60fps</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé Descritivo */}
              <div style={{ padding: '16px 20px', borderTop: `1px solid ${PRECISION_SURFACES.line}` }}>
                <p style={{ fontSize: '12.5px', color: PRECISION_TEXT.muted, margin: 0, lineHeight: 1.5 }}>
                  {activeVideo.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecondaryLayout>
  );
}
