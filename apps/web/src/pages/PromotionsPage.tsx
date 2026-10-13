import React, { useState, useEffect } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';
import { PromotionDetailModal } from '../components/modals/PromotionDetailModal';
import { getPromotions, activatePromotion, PromotionItem } from '../api/client';

const BASE_PROMOTIONS: PromotionItem[] = [
  {
    id: 'promo-welcome',
    title: 'Bono de Bienvenida para Práctica',
    badge: 'SIN REQUISITO DE DEPÓSITO',
    value: '$10.000 USD',
    subtext: 'Saldo de práctica recargable ilimitadamente',
    description: 'Acceso completo a todos los índices sintéticos y herramientas de dibujo técnico profesional para calibrar algoritmos y operativa manual sin riesgo de capital.',
    requirements: [
      'Vigencia: Renovación automática permanente',
      'Volumen de práctica sugerido: $50,000',
      'Acceso sin restricciones a todos los feeds OTC e índices continuos',
    ],
    actionText: 'Asignar saldo',
    isActive: true,
  },
  {
    id: 'promo-cashback',
    title: 'Cashback Semanal del 10%',
    badge: 'GESTIÓN DE RIESGO',
    value: 'Hasta $5,000 USD',
    subtext: 'Liquidación de balance los lunes 00:00 UTC',
    description: 'Reembolso auditado del 10% sobre el saldo neto no ganador acumulado semanalmente, acreditado directamente para preservar la continuidad de la cuenta.',
    requirements: [
      'Acreditación automática semanal vía libro contable Blnk',
      'Cálculo exacto sobre pérdida neta de la semana operativa',
      'Sin cláusulas de retención ni bloqueos de retiro',
    ],
    actionText: 'Activar protección',
    isActive: false,
  },
  {
    id: 'promo-tournament',
    title: 'Gran Torneo Mensual BINMAX',
    badge: 'PREMIOS EN BALANCE REAL',
    value: '$50,000 USD',
    subtext: 'Bolsa distribuida entre las 10 mejores posiciones',
    description: 'Demuestra consistencia y control de varianza en el ranking público compitiendo en igualdad de condiciones con la comunidad de traders.',
    requirements: [
      'Inscripción incluida sin tarifa adicional',
      'Mínimo de 15 contratos durante el período del certamen',
      'Clasificación por estricta rentabilidad porcentual',
    ],
    actionText: 'Inscribir posición',
    isActive: false,
  },
];

export function PromotionsPage() {
  const [promos, setPromos] = useState<PromotionItem[]>(BASE_PROMOTIONS);
  const [activePromos, setActivePromos] = useState<Set<string>>(new Set(['promo-welcome']));
  const [selectedPromo, setSelectedPromo] = useState<PromotionItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    getPromotions()
      .then((data) => {
        if (!isMounted || !Array.isArray(data) || data.length === 0) return;
        setPromos(data);
        const active = new Set<string>();
        data.forEach((p) => {
          if (p.isActive) active.add(p.id);
        });
        setActivePromos(active);
      })
      .catch((err) => {
        console.warn('[Promotions Load Error]', err);
      });
    return () => { isMounted = false; };
  }, []);

  const handleTogglePromo = async (id: string) => {
    try {
      const res = await activatePromotion(id);
      if (res && res.success) {
        setActivePromos((prev) => new Set(prev).add(id));
        setPromos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: true } : p))
        );
        return;
      }
    } catch (err) {
      console.warn('[Promotion Activate Error]', err);
    }
    // Fallback gracioso
    setActivePromos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  return (
    <>
    <SecondaryLayout activeNav="Promociones">
      <div
        data-testid="promotions-page-container"
        className="bm-page-enter"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* ─── CABEÇALHO TÉCNICO ───────────────────────────────────────── */}
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
              Programas Institucionales
            </span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>·</span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }}>
              Protocolo de Liquidez
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
            Promociones y Beneficios Institucionales
          </h1>
          <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, margin: '6px 0 0', maxWidth: '700px' }}>
            Estructuras de fomento de liquidez, práctica profesional y compensación de riesgo con reglas claras y contabilidad inmutable.
          </p>
        </div>

        {/* ─── GRADE DE PROGRAMAS (SURFACES TONAL EM VEZ DE BORDAS NEON) ─ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            marginBottom: '36px',
          }}
        >
          {promos.map((p) => {
            const isActivated = activePromos.has(p.id);

            return (
              <div
                key={p.id}
                data-testid={`promo-card-${p.id}`}
                style={{
                  backgroundColor: isActivated ? PRECISION_SURFACES.bg2 : PRECISION_SURFACES.bg1,
                  border: `1px solid ${isActivated ? 'rgba(255, 255, 255, 0.22)' : PRECISION_SURFACES.line}`,
                  borderRadius: '8px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                <div>
                  {/* Badge Técnico */}
                  <span
                    style={{
                      background: PRECISION_SURFACES.bg3,
                      color: PRECISION_COLORS.metal,
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.05em',
                      display: 'inline-block',
                      marginBottom: '14px',
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                    }}
                  >
                    {p.badge}
                  </span>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 10px' }}>
                    {p.title}
                  </h3>

                  <div style={{ marginBottom: '16px' }}>
                    <strong
                      style={{
                        fontSize: '26px',
                        color: PRECISION_TEXT.strong,
                        fontFamily: PRECISION_FONTS.mono,
                        fontWeight: 800,
                        display: 'block',
                      }}
                      className="bm-tabular-nums"
                    >
                      {p.value}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet }}>
                      {p.subtext}
                    </span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: PRECISION_TEXT.muted, lineHeight: 1.6, margin: '0 0 20px' }}>
                    {p.description}
                  </p>

                  {/* Requisitos Institucionais */}
                  <div style={{ borderTop: `1px solid ${PRECISION_SURFACES.line}`, paddingTop: '14px', marginBottom: '24px' }}>
                    <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Parámetros del Programa
                    </span>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: PRECISION_TEXT.muted }}>
                      {p.requirements.map((req, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ color: PRECISION_COLORS.metal, fontSize: '12px' }}>—</span>
                          <span style={{ lineHeight: 1.4 }}>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`activate-promo-btn-${p.id}`}
                  className="bm-btn-press"
                  onClick={() => setSelectedPromo(p)}
                  style={{
                    width: '100%',
                    background: isActivated ? PRECISION_SURFACES.bg3 : PRECISION_SURFACES.bg2,
                    color: isActivated ? PRECISION_COLORS.profit : PRECISION_TEXT.strong,
                    border: `1px solid ${isActivated ? PRECISION_COLORS.profit : PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    padding: '11px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  {isActivated ? '✓ Programa Asignado' : `${p.actionText} →`}
                </button>
              </div>
            );
          })}
        </div>

        {/* ─── BANNER DE AUDITORIA CONTÁBIL ───────────────────────────── */}
        <div
          style={{
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              background: PRECISION_SURFACES.bg2,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              color: PRECISION_COLORS.metal,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 2px' }}>
              Compromiso de Juego Limpio y Transparencia
            </h4>
            <p style={{ fontSize: '12px', color: PRECISION_TEXT.muted, margin: 0, lineHeight: 1.4 }}>
              Todas las asignaciones demostrativas y compensaciones de riesgo se registran en el libro contable inmutable de doble entrada de la plataforma. Sin retenciones sorpresivas ni condiciones abusivas de liberación.
            </p>
          </div>
        </div>
      </div>
    </SecondaryLayout>

    {/* ── Modal de Detalhes da Promoção ── */}
    {selectedPromo && (
      <PromotionDetailModal
        isOpen={!!selectedPromo}
        onClose={() => setSelectedPromo(null)}
        onActivate={(id) => {
          handleTogglePromo(id);
          setSelectedPromo(null);
        }}
        isActivated={activePromos.has(selectedPromo.id)}
        promotion={selectedPromo}
      />
    )}
    </>
  );
}
