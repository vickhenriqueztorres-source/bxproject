import React, { useState } from 'react';
import type { DrawingItem, DrawingToolType, IndicatorConfig } from './drawing-types';
import type { Timeframe } from './candle-adapter';
import type { ChartType } from './PriceChart';
import { isNewTraderoomEnabled } from '../lib/feature-flags';

// --- Ícones Vetoriais SVG Institucionais (Eliminam Emojis e Símbolos Rústicos) ---

function IconCandlestickPair({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="icon-candlestick-pair">
      <line x1="7" y1="3" x2="7" y2="21" stroke="#22C47A" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4.5" y="7" width="5" height="10" rx="1" fill="#22C47A" />
      <line x1="17" y1="3" x2="17" y2="21" stroke="#F2545B" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14.5" y="6" width="5" height="8" rx="1" fill="#F2545B" />
    </svg>
  );
}

function IconLineChart({ size = 18, color = '#38bdf8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="icon-line-chart">
      <path d="M3 17L9 11L14 15L21 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="7" r="2" fill={color} />
      <path d="M3 21H21" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWaveIndicators({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="icon-wave-indicators">
      <path d="M2 12C5 6 7 6 10 12C13 18 15 18 18 12C19.5 9 21 9 22 12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="2" fill="#22C47A" />
      <circle cx="18" cy="12" r="2" fill="#2E86DE" />
      <circle cx="6" cy="9" r="1.5" fill="#F2545B" />
    </svg>
  );
}

function IconToolPencil({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="icon-tool-pencil">
      <path d="M3 21L7.5 20.5L20 8L16 4L3.5 16.5L3 21Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="6" x2="18" y2="10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ size = 16, color = '#f87171' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="icon-trash">
      <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolLine({ color = '#ef4444' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="13" r="2" fill={color} />
      <circle cx="13" cy="3" r="2" fill={color} />
      <line x1="3" y1="13" x2="13" y2="3" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function IconToolTrend({ color = '#eab308' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <path d="M2 13L8 7L11 10L14 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3H14V7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolHorizontal({ color = '#0ea5e9' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <line x1="1" y1="8" x2="15" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" fill={color} />
    </svg>
  );
}

function IconToolVertical({ color = '#06b6d4' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="1" x2="8" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" fill={color} />
    </svg>
  );
}

function IconToolFibonacci({ color = '#10b981' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <line x1="1" y1="2" x2="15" y2="2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="6" x2="15" y2="6" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1="1" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1="1" y1="14" x2="15" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHelpCircle({ size = 14, color = '#94a3b8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  );
}

export interface ChartDrawingToolbarProps {
  chartType: ChartType;
  onSelectChartType: (type: ChartType) => void;
  timeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  drawingsCount: number;
  drawings?: DrawingItem[];
  onRemoveDrawing?: (id: string) => void;
  onClearDrawings: () => void;
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
}

export function ChartDrawingToolbar({
  chartType,
  onSelectChartType,
  timeframe,
  onSelectTimeframe,
  activeTool,
  onSelectTool,
  activeColor,
  onChangeColor,
  drawingsCount,
  drawings = [],
  onRemoveDrawing,
  onClearDrawings,
  indicators,
  onToggleIndicator,
}: ChartDrawingToolbarProps) {
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState(false);
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const isBinmax = isNewTraderoomEnabled();

  const colors = ['#00e676', '#ffeb3b', '#00b0ff', '#ff3d71', '#e040fb', '#ffffff'];

  const closeAll = () => {
    setShowToolsMenu(false);
    setShowIndicatorsMenu(false);
    setShowTimeframeMenu(false);
    setShowTypeMenu(false);
  };

  return (
    <div
      className="chart-drawing-toolbar-container"
      data-testid="chart-drawing-toolbar"
      style={{
        position: 'absolute',
        left: isBinmax ? '16px' : '14px',
        bottom: isBinmax ? '20px' : undefined,
        top: isBinmax ? undefined : '60px',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      {/* Coluna de Botões Flutuantes da Barra Esquerda */}
      <div
        className="chart-drawing-toolbar-dock"
        data-testid="chart-drawing-toolbar-dock"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: isBinmax ? 'rgba(18, 24, 38, 0.85)' : 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          border: isBinmax ? '1px solid rgba(244, 245, 247, 0.1)' : '1px solid #1e293b',
          borderRadius: '8px',
          padding: '6px',
          boxShadow: isBinmax ? '0 10px 30px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* 1. Tipo de Gráfico (Velas/Linhas) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-testid="btn-chart-type"
            onClick={() => {
              closeAll();
              setShowTypeMenu(!showTypeMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showTypeMenu ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
              border: '1px solid ' + (showTypeMenu ? (isBinmax ? '#22C55E' : '#00e5ff') : 'transparent'),
              color: '#e2e8f0',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'all 0.2s ease',
            }}
            title={isBinmax ? 'Tipo de Gráfico' : 'Tipo de Gráfico'}
          >
            {isBinmax ? (
              chartType === 'candles' ? <IconCandlestickPair /> : <IconLineChart />
            ) : (
              chartType === 'candles' ? '🕯️' : '📈'
            )}
          </button>

          {showTypeMenu && (
            <div
              data-testid="menu-chart-type"
              style={{
                position: 'absolute',
                left: '46px',
                top: isBinmax ? undefined : 0,
                bottom: isBinmax ? 0 : undefined,
                background: isBinmax ? '#151922' : '#0f172a',
                border: isBinmax ? '1px solid rgba(244, 245, 247, 0.12)' : '1px solid #1e293b',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '130px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
                zIndex: 30,
              }}
            >
              <button
                type="button"
                data-testid="opt-chart-candles"
                onClick={() => {
                  onSelectChartType('candles');
                  setShowTypeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: chartType === 'candles' ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
                  border: 'none',
                  color: chartType === 'candles' ? (isBinmax ? '#22C47A' : '#00e676') : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isBinmax ? <IconCandlestickPair size={16} /> : '🕯️'}</span> {isBinmax ? 'Velas' : 'Velas'}
              </button>
              <button
                type="button"
                data-testid="opt-chart-line"
                onClick={() => {
                  onSelectChartType('line');
                  setShowTypeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: chartType === 'line' ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
                  border: 'none',
                  color: chartType === 'line' ? (isBinmax ? '#22C47A' : '#00e676') : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isBinmax ? <IconLineChart size={16} /> : '📈'}</span> {isBinmax ? 'Línea' : 'Linha'}
              </button>
            </div>
          )}
        </div>

        {/* 2. Período de Vela (Timeframe) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-testid="btn-timeframe"
            onClick={() => {
              closeAll();
              setShowTimeframeMenu(!showTimeframeMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showTimeframeMenu ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
              border: '1px solid ' + (showTimeframeMenu ? (isBinmax ? '#22C55E' : '#00e5ff') : 'transparent'),
              color: isBinmax ? '#ffffff' : '#38bdf8',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'all 0.2s ease',
            }}
            title={isBinmax ? 'Período de Vela' : 'Período de Vela'}
          >
            {timeframe}
          </button>

          {showTimeframeMenu && (
            <div
              data-testid="menu-timeframe"
              style={{
                position: 'absolute',
                left: '46px',
                top: isBinmax ? undefined : 0,
                bottom: isBinmax ? 0 : undefined,
                background: isBinmax ? '#151922' : '#0f172a',
                border: isBinmax ? '1px solid rgba(244, 245, 247, 0.12)' : '1px solid #1e293b',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '100px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
                zIndex: 30,
              }}
            >
              {(['5s', '15s', '30s', '1m', '5m'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  data-testid={`opt-tf-${tf}`}
                  onClick={() => {
                    onSelectTimeframe(tf);
                    setShowTimeframeMenu(false);
                  }}
                  style={{
                    background: timeframe === tf ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
                    border: 'none',
                    color: timeframe === tf ? (isBinmax ? '#22C47A' : '#38bdf8') : '#94a3b8',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Indicadores Técnicos */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-testid="btn-indicators"
            onClick={() => {
              closeAll();
              setShowIndicatorsMenu(!showIndicatorsMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showIndicatorsMenu || indicators.some((i) => i.enabled) ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
              border: '1px solid ' + (showIndicatorsMenu ? (isBinmax ? '#22C55E' : '#00e5ff') : 'transparent'),
              color: indicators.some((i) => i.enabled) ? (isBinmax ? '#22C47A' : '#00e676') : '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
            title={isBinmax ? 'Indicadores Técnicos' : 'Indicadores Técnicos'}
          >
            {isBinmax ? <IconWaveIndicators /> : '((•))'}
            {indicators.filter((i) => i.enabled).length > 0 && (
              <span
                data-testid="indicators-count-badge"
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: isBinmax ? '#22C47A' : '#00e676',
                  color: '#000',
                  fontSize: '9px',
                  fontWeight: 900,
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {indicators.filter((i) => i.enabled).length}
              </span>
            )}
          </button>

          {showIndicatorsMenu && (
            <div
              data-testid="menu-indicators"
              style={{
                position: 'absolute',
                left: '46px',
                top: isBinmax ? undefined : 0,
                bottom: isBinmax ? 0 : undefined,
                background: isBinmax ? '#151922' : '#0f172a',
                border: isBinmax ? '1px solid rgba(244, 245, 247, 0.12)' : '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '260px',
                maxHeight: '440px',
                overflowY: 'auto',
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
                zIndex: 30,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#f1f5f9',
                  borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.1)' : '1px solid #1e293b',
                  paddingBottom: '6px',
                  letterSpacing: '0.5px',
                }}
              >
                <span>{isBinmax ? 'INDICADORES TÉCNICOS' : 'INDICADORES TÉCNICOS'}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {indicators.filter((i) => i.enabled).length} {isBinmax ? 'activos' : 'ativos'}
                </span>
              </div>
              {indicators.map((ind) => {
                const label =
                  ind.type === 'VWAP'
                    ? 'VWAP'
                    : ind.type === 'MACD'
                    ? `MACD (${ind.fastPeriod ?? 12}, ${ind.slowPeriod ?? 26})`
                    : ind.type === 'STOCHASTIC'
                    ? (isBinmax ? `Estocástico (${ind.kPeriod ?? 14}, ${ind.dPeriod ?? 3})` : `Estocástico (${ind.kPeriod ?? 14}, ${ind.dPeriod ?? 3})`)
                    : `${ind.type} ${ind.period}`;

                return (
                  <button
                    key={ind.id}
                    type="button"
                    data-testid={`ind-toggle-${ind.id}`}
                    onClick={() => onToggleIndicator(ind.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: ind.enabled ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
                      border: '1px solid ' + (ind.enabled ? ind.color : (isBinmax ? 'rgba(255,255,255,0.06)' : '#1e293b')),
                      color: ind.enabled ? '#fff' : '#94a3b8',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: ind.color,
                          boxShadow: ind.enabled ? `0 0 6px ${ind.color}` : 'none',
                        }}
                      />
                      <span style={{ fontWeight: ind.enabled ? 700 : 500 }}>{label}</span>
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: ind.enabled ? (isBinmax ? '#22C47A' : '#00e676') : '#64748b',
                        fontWeight: ind.enabled ? 700 : 400,
                      }}
                    >
                      {ind.enabled ? (isBinmax ? '✓ Activo' : '✓ Ativo') : (isBinmax ? '+ Agregar' : '+ Adicionar')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Ferramentas Gráficas */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            data-testid="btn-tools"
            onClick={() => {
              closeAll();
              setShowToolsMenu(!showToolsMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showToolsMenu || activeTool ? (isBinmax ? '#233044' : '#1e293b') : 'transparent',
              border: '1px solid ' + (activeTool ? (isBinmax ? '#22C55E' : '#00e676') : showToolsMenu ? (isBinmax ? '#22C55E' : '#00e5ff') : 'transparent'),
              color: activeTool ? (isBinmax ? '#22C47A' : '#00e676') : '#94a3b8',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
            title={isBinmax ? 'Herramientas Gráficas' : 'Ferramentas Gráficas'}
          >
            {isBinmax ? <IconToolPencil /> : '✏️'}
            {!isBinmax && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ff9800',
                  color: '#000',
                  fontSize: '8px',
                  fontWeight: 900,
                  padding: '1px 3px',
                  borderRadius: '3px',
                  pointerEvents: 'none',
                }}
              >
                NEW
              </span>
            )}
          </button>

          {/* Popup Flutuante de Ferramentas Gráficas */}
          {showToolsMenu && (
            <div
              data-testid="menu-tools"
              style={{
                position: 'absolute',
                left: '46px',
                top: isBinmax ? undefined : 0,
                bottom: isBinmax ? 0 : undefined,
                background: isBinmax ? '#151922' : '#14171d',
                border: isBinmax ? '1px solid rgba(244, 245, 247, 0.12)' : '1px solid #2b3340',
                borderRadius: '10px',
                display: 'flex',
                boxShadow: '0 12px 35px rgba(0,0,0,0.8)',
                zIndex: 35,
                overflow: 'hidden',
                minWidth: '500px',
              }}
            >
              {/* Coluna Esquerda: Lista de Ferramentas */}
              <div
                style={{
                  width: '260px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  borderRight: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #232b36',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  {isBinmax ? 'HERRAMIENTAS GRÁFICAS' : 'FERRAMENTAS GRÁFICAS'}
                </div>

                {/* 1. Linha */}
                <button
                  type="button"
                  data-testid="tool-btn-line"
                  onClick={() => {
                    onSelectTool('line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'line' ? (isBinmax ? '#233044' : '#1f2937') : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBinmax ? <IconToolLine /> : <span style={{ color: '#ef4444', fontWeight: 900 }}>⤢</span>}
                  <span>{isBinmax ? 'Línea' : 'Linha'}</span>
                </button>

                {/* 2. Linha de tendência */}
                <button
                  type="button"
                  data-testid="tool-btn-trend-line"
                  onClick={() => {
                    onSelectTool('trend_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'trend_line' ? (isBinmax ? '#233044' : '#1f2937') : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBinmax ? <IconToolTrend /> : <span style={{ color: '#eab308', fontWeight: 900 }}>╱</span>}
                  <span>{isBinmax ? 'Línea de tendencia' : 'Linha de tendência'}</span>
                </button>

                {/* 3. Linha horizontal */}
                <button
                  type="button"
                  data-testid="tool-btn-horizontal-line"
                  onClick={() => {
                    onSelectTool('horizontal_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'horizontal_line' ? (isBinmax ? '#233044' : '#1f2937') : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBinmax ? <IconToolHorizontal /> : <span style={{ color: '#0ea5e9', fontWeight: 900 }}>—</span>}
                  <span>{isBinmax ? 'Línea horizontal' : 'Linha horizontal'}</span>
                </button>

                {/* 4. Linha vertical */}
                <button
                  type="button"
                  data-testid="tool-btn-vertical-line"
                  onClick={() => {
                    onSelectTool('vertical_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'vertical_line' ? (isBinmax ? '#233044' : '#1f2937') : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBinmax ? <IconToolVertical /> : <span style={{ color: '#06b6d4', fontWeight: 900 }}>|</span>}
                  <span>{isBinmax ? 'Línea vertical' : 'Linha vertical'}</span>
                </button>

                {/* 5. Linhas de Fibonacci */}
                <button
                  type="button"
                  data-testid="tool-btn-fibonacci"
                  onClick={() => {
                    onSelectTool('fibonacci');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'fibonacci' ? (isBinmax ? '#233044' : '#1f2937') : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isBinmax ? <IconToolFibonacci /> : <span style={{ color: '#10b981', fontWeight: 900 }}>☰</span>}
                  <span>{isBinmax ? 'Líneas de Fibonacci' : 'Linhas de Fibonacci'}</span>
                </button>
              </div>

              {/* Coluna Direita: Ajuda, Paleta de Cores e Gerenciador de Desenhos Ativos */}
              <div
                style={{
                  flex: 1,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: isBinmax ? '#0F1218' : '#0d1016',
                  minWidth: '280px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
                    {isBinmax ? 'COLOR DE LÍNEA' : 'COR DA LINHA'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChangeColor(c)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: c,
                          border: activeColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {drawings && drawings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: isBinmax ? '#22C47A' : '#38bdf8', letterSpacing: '0.5px' }}>
                        {isBinmax ? `DIBUJOS ACTIVOS (${drawings.length})` : `DESENHOS ATIVOS (${drawings.length})`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClearDrawings();
                          setShowToolsMenu(false);
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#f87171',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {isBinmax ? 'Eliminar todos' : 'Limpar Todos'}
                      </button>
                    </div>

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                      {drawings.map((d, idx) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isBinmax ? '#151922' : '#161d2a',
                            border: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #243044',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#e2e8f0',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>
                              {d.type === 'horizontal_line' ? `Horizontal @ ${d.p1.price.toFixed(2)}` :
                               d.type === 'vertical_line' ? `Vertical #${idx + 1}` :
                               d.type === 'trend_line' ? (isBinmax ? `Tendencia #${idx + 1}` : `Tendência #${idx + 1}`) :
                               d.type === 'fibonacci' ? `Fibonacci #${idx + 1}` :
                               (isBinmax ? `Línea #${idx + 1}` : `Linha #${idx + 1}`)}
                            </span>
                          </span>
                          {onRemoveDrawing && (
                            <button
                              type="button"
                              onClick={() => onRemoveDrawing(d.id)}
                              style={{
                                background: '#ef4444',
                                border: 'none',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                              title="Excluir este desenho"
                            >
                              {isBinmax ? '✕ Eliminar' : '✕ Excluir'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                      {isBinmax ? <IconHelpCircle /> : <span>❔</span>}
                      <span>{isBinmax ? 'Ayuda de análisis' : 'Ajuda de Análise'}</span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.5' }}>
                      {isBinmax
                        ? 'Seleccione una herramienta a la izquierda y haga clic en el gráfico para colocar soporte, resistencia o líneas de tendencia.'
                        : 'Selecione uma ferramenta à esquerda e clique no gráfico para posicionar suporte, resistência ou linhas de tendência.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Limpar Desenhos (Lixeira com Contador) */}
        {drawingsCount > 0 && (
          <button
            type="button"
            data-testid="btn-clear-drawings"
            onClick={onClearDrawings}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: '#2d151e',
              border: '1px solid #7f1d1d',
              color: '#f87171',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'all 0.2s ease',
            }}
            title={isBinmax ? `Eliminar todos los ${drawingsCount} dibujos` : `Remover todos os ${drawingsCount} desenhos`}
          >
            {isBinmax ? <IconTrash /> : '🗑️'}
          </button>
        )}
      </div>

      {/* Banner de Ferramenta Ativa */}
      {activeTool && (
        <div
          data-testid="active-tool-banner"
          style={{
            background: isBinmax ? 'rgba(18, 24, 38, 0.95)' : 'rgba(15, 23, 42, 0.92)',
            border: isBinmax ? '1px solid #22C47A' : '1px solid #00e676',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            color: isBinmax ? '#22C47A' : '#00e676',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span>{isBinmax ? 'Dibujar' : 'Desenhar'}: <strong>{activeTool.replace('_', ' ')}</strong></span>
          <button
            type="button"
            onClick={() => onSelectTool(null as unknown as DrawingToolType)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: 0,
            }}
            title={isBinmax ? 'Cancelar herramienta' : 'Cancelar ferramenta'}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
