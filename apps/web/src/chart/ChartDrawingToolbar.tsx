import React, { useState } from 'react';
import type { DrawingItem, DrawingToolType, IndicatorConfig } from './drawing-types';
import type { Timeframe } from './candle-adapter';
import type { ChartType } from './PriceChart';

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

  const colors = ['#00e676', '#ffeb3b', '#00b0ff', '#ff3d71', '#e040fb', '#ffffff'];

  const closeAll = () => {
    setShowToolsMenu(false);
    setShowIndicatorsMenu(false);
    setShowTimeframeMenu(false);
    setShowTypeMenu(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: '14px',
        top: '60px',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      {/* Coluna de Botões Flutuantes da Barra Esquerda */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* 1. Tipo de Gráfico (Velas/Linhas) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              closeAll();
              setShowTypeMenu(!showTypeMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showTypeMenu ? '#1e293b' : 'transparent',
              border: '1px solid ' + (showTypeMenu ? '#3b82f6' : 'transparent'),
              color: '#e2e8f0',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Tipo de Gráfico"
          >
            {chartType === 'candles' ? '🕯️' : '📈'}
          </button>

          {showTypeMenu && (
            <div
              style={{
                position: 'absolute',
                left: '46px',
                top: 0,
                background: '#0f172a',
                border: '1px solid #1e293b',
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
                onClick={() => {
                  onSelectChartType('candles');
                  setShowTypeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: chartType === 'candles' ? '#1e293b' : 'transparent',
                  border: 'none',
                  color: chartType === 'candles' ? '#00e676' : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>🕯️</span> Velas
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectChartType('line');
                  setShowTypeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: chartType === 'line' ? '#1e293b' : 'transparent',
                  border: 'none',
                  color: chartType === 'line' ? '#00e676' : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>📈</span> Linha
              </button>
            </div>
          )}
        </div>

        {/* 2. Período de Vela (Timeframe) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              closeAll();
              setShowTimeframeMenu(!showTimeframeMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showTimeframeMenu ? '#1e293b' : 'transparent',
              border: '1px solid ' + (showTimeframeMenu ? '#3b82f6' : 'transparent'),
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Período de Vela"
          >
            {timeframe}
          </button>

          {showTimeframeMenu && (
            <div
              style={{
                position: 'absolute',
                left: '46px',
                top: 0,
                background: '#0f172a',
                border: '1px solid #1e293b',
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
                  onClick={() => {
                    onSelectTimeframe(tf);
                    setShowTimeframeMenu(false);
                  }}
                  style={{
                    background: timeframe === tf ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: timeframe === tf ? '#38bdf8' : '#94a3b8',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Indicadores Técnicos ((•)) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              closeAll();
              setShowIndicatorsMenu(!showIndicatorsMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showIndicatorsMenu || indicators.some((i) => i.enabled) ? '#1e293b' : 'transparent',
              border: '1px solid ' + (showIndicatorsMenu ? '#3b82f6' : 'transparent'),
              color: indicators.some((i) => i.enabled) ? '#00e676' : '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
            title="Indicadores Técnicos"
          >
            ((•))
            {indicators.filter((i) => i.enabled).length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#00e676',
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
              style={{
                position: 'absolute',
                left: '46px',
                top: 0,
                background: '#0f172a',
                border: '1px solid #1e293b',
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
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: '6px',
                }}
              >
                <span>INDICADORES TÉCNICOS</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {indicators.filter((i) => i.enabled).length} ativos
                </span>
              </div>
              {indicators.map((ind) => {
                const label =
                  ind.type === 'VWAP'
                    ? 'VWAP'
                    : ind.type === 'MACD'
                    ? `MACD (${ind.fastPeriod ?? 12}, ${ind.slowPeriod ?? 26})`
                    : ind.type === 'STOCHASTIC'
                    ? `Estocástico (${ind.kPeriod ?? 14}, ${ind.dPeriod ?? 3})`
                    : `${ind.type} ${ind.period}`;

                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => onToggleIndicator(ind.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: ind.enabled ? '#1e293b' : 'transparent',
                      border: '1px solid ' + (ind.enabled ? ind.color : '#1e293b'),
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
                        color: ind.enabled ? '#00e676' : '#64748b',
                        fontWeight: ind.enabled ? 700 : 400,
                      }}
                    >
                      {ind.enabled ? '✓ Ativo' : '+ Adicionar'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Ferramentas Gráficas (Lápis com Badge NEW) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              closeAll();
              setShowToolsMenu(!showToolsMenu);
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: showToolsMenu || activeTool ? '#1e293b' : 'transparent',
              border: '1px solid ' + (activeTool ? '#00e676' : showToolsMenu ? '#3b82f6' : 'transparent'),
              color: activeTool ? '#00e676' : '#94a3b8',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
            title="Ferramentas Gráficas"
          >
            ✏️
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
          </button>

          {/* Popup Flutuante Idêntico à Imagem 2 */}
          {showToolsMenu && (
            <div
              style={{
                position: 'absolute',
                left: '46px',
                top: 0,
                background: '#14171d',
                border: '1px solid #2b3340',
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
                  borderRight: '1px solid #232b36',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  FERRAMENTAS GRÁFICAS
                </div>

                {/* 1. Linha */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'line' ? '#1f2937' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#ef4444', fontWeight: 900 }}>⤢</span>
                  Linha
                </button>

                {/* 2. Linha de tendência */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('trend_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'trend_line' ? '#1f2937' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#eab308', fontWeight: 900 }}>╱</span>
                  Linha de tendência
                </button>

                {/* 3. Linha horizontal */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('horizontal_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'horizontal_line' ? '#1f2937' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#0ea5e9', fontWeight: 900 }}>—</span>
                  Linha horizontal
                </button>

                {/* 4. Linha vertical */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('vertical_line');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'vertical_line' ? '#1f2937' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#06b6d4', fontWeight: 900 }}>|</span>
                  Linha vertical
                </button>

                {/* 5. Linhas de Fibonacci */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('fibonacci');
                    setShowToolsMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: activeTool === 'fibonacci' ? '#1f2937' : 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    padding: '10px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: '#10b981', fontWeight: 900 }}>☰</span>
                  Linhas de Fibonacci
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
                  background: '#0d1016',
                  minWidth: '280px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
                    COR DA LINHA
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
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.5px' }}>
                        DESENHOS ATIVOS ({drawings.length})
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
                        Limpar Todos
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
                            background: '#161d2a',
                            border: '1px solid #243044',
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
                               d.type === 'trend_line' ? `Tendência #${idx + 1}` :
                               d.type === 'fibonacci' ? `Fibonacci #${idx + 1}` :
                               `Linha #${idx + 1}`}
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
                              ✕ Excluir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>
                      <span>❔</span>
                      <span>Ajuda de Análise</span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '11px', lineHeight: '1.5' }}>
                      Selecione uma ferramenta à esquerda e clique no gráfico para posicionar suporte, resistência ou linhas de tendência.
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
            }}
            title={`Remover todos os ${drawingsCount} desenhos`}
          >
            🗑️
          </button>
        )}
      </div>

      {/* Banner de Ferramenta Ativa */}
      {activeTool && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #00e676',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#00e676',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span>Desenhar: <strong>{activeTool.replace('_', ' ')}</strong></span>
          <button
            type="button"
            onClick={() => onSelectTool(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              padding: 0,
            }}
            title="Cancelar ferramenta"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
