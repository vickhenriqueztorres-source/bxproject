import React, { useEffect, useRef } from 'react';

export type GridLayout = '1x1' | '2x1' | '2x2' | '3x2';

export interface GridLayoutPopoverProps {
  isOpen: boolean;
  currentLayout: GridLayout;
  onSelectLayout: (layout: GridLayout) => void;
  onClose: () => void;
}

interface LayoutOption {
  layout: GridLayout;
  title: string;
  desc: string;
  cols: number;
  rows: number;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { layout: '1x1', title: '1 Gráfico (Completo)', desc: '1 pantalla completa', cols: 1, rows: 1 },
  { layout: '2x1', title: '2 Gráficos (Dividido)', desc: 'Pantalla dividida 2x1', cols: 2, rows: 1 },
  { layout: '2x2', title: '4 Gráficos (Cuadrícula 2x2)', desc: 'Cuadrícula de 4 pantallas', cols: 2, rows: 2 },
  { layout: '3x2', title: '6 Gráficos (Institucional 3x2)', desc: 'Máximo institucional (6 pantallas)', cols: 3, rows: 2 },
];

export function GridLayoutPopover({
  isOpen,
  currentLayout,
  onSelectLayout,
  onClose,
}: GridLayoutPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="grid-layout-popover"
      style={{
        position: 'absolute',
        top: '46px',
        left: '120px',
        zIndex: 9999,
        background: '#0D0F14',
        border: '1px solid rgba(244, 245, 247, 0.12)',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(0, 229, 255, 0.1)',
        padding: '12px',
        width: '280px',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
          paddingBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#F4F5F7',
            letterSpacing: '0.5px',
          }}
        >
          Distribución de Gráficos
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8A92A1',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px',
            lineHeight: 1,
          }}
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {LAYOUT_OPTIONS.map((opt) => {
          const isActive = currentLayout === opt.layout;
          return (
            <button
              key={opt.layout}
              type="button"
              data-layout={opt.layout}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => {
                onSelectLayout(opt.layout);
                onClose();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 6px',
                borderRadius: '6px',
                background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'rgba(21, 25, 34, 0.6)',
                border: isActive
                  ? '1px solid #00e5ff'
                  : '1px solid rgba(244, 245, 247, 0.08)',
                color: isActive ? '#00e5ff' : '#8A92A1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
              title={opt.title}
            >
              {/* Miniatura geométrica do layout */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${opt.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${opt.rows}, 1fr)`,
                  gap: '2px',
                  width: '32px',
                  height: '24px',
                  padding: '2px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '3px',
                  border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                }}
              >
                {Array.from({ length: opt.cols * opt.rows }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: isActive ? '#00e5ff' : 'rgba(244, 245, 247, 0.25)',
                      borderRadius: '1px',
                    }}
                  />
                ))}
              </div>

              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  textAlign: 'center',
                  color: isActive ? '#FFFFFF' : '#8A92A1',
                }}
              >
                {opt.title}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(244, 245, 247, 0.06)',
          fontSize: '9px',
          color: '#687896',
          textAlign: 'center',
        }}
      >
        Cada gráfico opera con símbolo y escala independientes
      </div>
    </div>
  );
}
