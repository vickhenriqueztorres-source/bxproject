import React, { useEffect } from 'react';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../../lib/design-tokens';

/* ═══════════════════════════════════════════════════════════════════════
   PromotionDetailModal — Modal Institucional de Detalhes de Promoção
   Padrão: TournamentModal + AssetCatalogModal + Motion tokens BINMAX
   "A BINMAX É UM INSTRUMENTO DE PRECISÃO, NÃO UM CASSINO."
   ═══════════════════════════════════════════════════════════════════════ */

export interface PromotionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: (promoId: string) => void;
  isActivated: boolean;
  promotion: {
    id: string;
    title: string;
    badge: string;
    value: string;
    subtext: string;
    description: string;
    requirements: string[];
    actionText: string;
  };
}

export function PromotionDetailModal({
  isOpen,
  onClose,
  onActivate,
  isActivated,
  promotion,
}: PromotionDetailModalProps) {
  // Tecla Escape para fechar — padrão canônico do projeto
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="promotion-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Backdrop com desfoque institucional ── */}
      <div
        data-testid="promotion-detail-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(5, 8, 16, 0.78)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: `opacity ${PRECISION_MOTION.tBase}ms ${PRECISION_MOTION.ease}`,
        }}
      />

      {/* ── Caixa de Diálogo Principal ── */}
      <div
        className="bm-modal-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: PRECISION_SURFACES.bg0,
          border: `1px solid ${PRECISION_SURFACES.line}`,
          borderRadius: '12px',
          boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.03)',
          zIndex: 1,
          fontFamily: PRECISION_FONTS.sans,
          color: PRECISION_TEXT.strong,
        }}
      >
        {/* ── Header: Badge + Fechar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
          }}
        >
          {/* Badge Técnico */}
          <span
            style={{
              background: PRECISION_SURFACES.bg3,
              color: PRECISION_COLORS.metal,
              fontSize: '10px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '4px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              border: `1px solid ${PRECISION_SURFACES.line}`,
            }}
          >
            {promotion.badge}
          </span>

          {/* Botão Fechar */}
          <button
            type="button"
            data-testid="promotion-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: PRECISION_TEXT.muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              borderRadius: '4px',
              transition: `color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Corpo do Modal ── */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* Título */}
          <h2
            id="promotion-modal-title"
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: PRECISION_TEXT.strong,
              margin: '0 0 16px',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            {promotion.title}
          </h2>

          {/* Valor Destacado (Protagonista Visual) */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            <strong
              className="bm-tabular-nums"
              style={{
                fontSize: '32px',
                color: PRECISION_TEXT.strong,
                fontFamily: PRECISION_FONTS.mono,
                fontWeight: 800,
                display: 'block',
                lineHeight: 1.2,
              }}
            >
              {promotion.value}
            </strong>
            <span
              style={{
                fontSize: '12px',
                color: PRECISION_TEXT.quiet,
                marginTop: '4px',
                display: 'block',
              }}
            >
              {promotion.subtext}
            </span>
          </div>

          {/* Descrição */}
          <p
            style={{
              fontSize: '13px',
              color: PRECISION_TEXT.muted,
              lineHeight: 1.6,
              margin: '0 0 20px',
            }}
          >
            {promotion.description}
          </p>

          {/* Parâmetros do Programa */}
          {promotion.requirements.length > 0 && (
            <div
              style={{
                borderTop: `1px solid ${PRECISION_SURFACES.line}`,
                paddingTop: '16px',
                marginBottom: '20px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: PRECISION_TEXT.quiet,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: '10px',
                }}
              >
                Parámetros del Programa
              </span>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {promotion.requirements.map((req, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '12px',
                      color: PRECISION_TEXT.muted,
                    }}
                  >
                    <span
                      style={{
                        color: PRECISION_COLORS.metal,
                        fontSize: '12px',
                        lineHeight: 1.4,
                        flexShrink: 0,
                      }}
                    >
                      —
                    </span>
                    <span style={{ lineHeight: 1.4 }}>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Condições de Transparência */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '6px',
              padding: '12px 14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PRECISION_COLORS.metal}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: '1px' }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span
              style={{
                fontSize: '11px',
                color: PRECISION_TEXT.quiet,
                lineHeight: 1.5,
              }}
            >
              Reglas claras, sin letras pequeñas. Contabilidad inmutable de doble entrada.
            </span>
          </div>

          {/* Botão de Ação */}
          <button
            type="button"
            data-testid={`promotion-modal-action-${promotion.id}`}
            className="bm-btn-press"
            onClick={() => onActivate(promotion.id)}
            style={{
              width: '100%',
              background: isActivated ? PRECISION_SURFACES.bg3 : PRECISION_COLORS.profit,
              color: isActivated ? PRECISION_COLORS.profit : '#08140B',
              border: isActivated
                ? `1px solid ${PRECISION_COLORS.profit}`
                : '1px solid transparent',
              borderRadius: '8px',
              padding: '13px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: PRECISION_FONTS.sans,
              transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
            }}
          >
            {isActivated ? (
              <>
                <span style={{ fontSize: '14px' }}>✓</span>
                Programa Asignado
              </>
            ) : (
              <>
                {promotion.actionText}
                <span style={{ fontSize: '16px' }}>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
