import React, { useEffect, useState, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import {
  FIBONACCI_LEVELS,
  type DrawingItem,
  type DrawingToolType,
  type Point2D,
} from './drawing-types';
import { safeRandomUUID } from '../lib/uuid';

export interface ChartDrawingOverlayProps {
  chartInstance: IChartApi | null;
  activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null;
  containerWidth: number;
  containerHeight: number;
  drawings: DrawingItem[];
  onAddDrawing: (drawing: DrawingItem) => void;
  onUpdateDrawing?: (drawing: DrawingItem) => void;
  onRemoveDrawing: (id: string) => void;
  activeTool: DrawingToolType;
  onFinishDrawing: () => void;
  activeColor: string;
}

interface DragState {
  drawingId: string;
  handle: 'body' | 'p1' | 'p2';
  startPrice: number;
  startLogical: number;
  initialP1: Point2D;
  initialP2?: Point2D;
}

export function ChartDrawingOverlay({
  chartInstance,
  activeSeries,
  containerWidth,
  containerHeight,
  drawings,
  onAddDrawing,
  onUpdateDrawing,
  onRemoveDrawing,
  activeTool,
  onFinishDrawing,
  activeColor,
}: ChartDrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setRedrawKey] = useState(0);
  const [firstPoint, setFirstPoint] = useState<Point2D | null>(null);
  const [previewPoint, setPreviewPoint] = useState<Point2D | null>(null);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const pendingPointRef = useRef<Point2D | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);

  // Forçar redraw do SVG em zoom/pan da escala do Lightweight Charts
  useEffect(() => {
    if (!chartInstance) return;
    const timeScale = chartInstance.timeScale();
    const handleRangeChange = () => {
      setRedrawKey((k) => k + 1);
    };
    timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
    };
  }, [chartInstance]);

  // Reset de desenho em andamento se ferramenta for cancelada
  useEffect(() => {
    if (!activeTool) {
      setFirstPoint(null);
      setPreviewPoint(null);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [activeTool]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, []);

  // Manipulador de início de arraste de linha ou ponto de controle
  const handleStartDrag = (
    e: React.MouseEvent,
    drawingId: string,
    handle: 'body' | 'p1' | 'p2'
  ) => {
    if (activeTool) return;
    e.stopPropagation();
    e.preventDefault();

    const drawing = drawings.find((d) => d.id === drawingId);
    if (!drawing || !chartInstance || !activeSeries) return;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;

    const startPrice = activeSeries.coordinateToPrice(mouseY);
    const startLogical = chartInstance.timeScale().coordinateToLogical(mouseX);

    if (startPrice === null) return;

    setSelectedDrawingId(drawingId);
    setDragState({
      drawingId,
      handle,
      startPrice: Number(startPrice),
      startLogical: startLogical !== null ? Number(startLogical) : 0,
      initialP1: { ...drawing.p1 },
      initialP2: drawing.p2 ? { ...drawing.p2 } : undefined,
    });
  };

  // Efeito global de arraste contínuo a 60 FPS
  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: MouseEvent) => {
      if (!svgRef.current || !chartInstance || !activeSeries) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const currentX = e.clientX - svgRect.left;
      const currentY = e.clientY - svgRect.top;

      const currentPrice = activeSeries.coordinateToPrice(currentY);
      const currentLogical = chartInstance.timeScale().coordinateToLogical(currentX);

      if (currentPrice === null) return;

      const deltaPrice = Number(currentPrice) - dragState.startPrice;
      const deltaLogical = (currentLogical !== null ? Number(currentLogical) : 0) - dragState.startLogical;

      const drawing = drawings.find((d) => d.id === dragState.drawingId);
      if (!drawing) return;

      const updatedDrawing: DrawingItem = { ...drawing };

      if (dragState.handle === 'body') {
        if (drawing.type === 'horizontal_line') {
          // Linha horizontal translada estritamente no eixo Y (preço)
          updatedDrawing.p1 = {
            ...dragState.initialP1,
            price: Number(currentPrice),
          };
        } else if (drawing.type === 'vertical_line') {
          // Linha vertical translada estritamente no eixo X (tempo/logical)
          const newLogical = (dragState.initialP1.logical ?? 0) + deltaLogical;
          const timeScale = chartInstance.timeScale();
          const newTime = timeScale.coordinateToTime(currentX);
          updatedDrawing.p1 = {
            ...dragState.initialP1,
            logical: newLogical,
            time: (newTime ?? dragState.initialP1.time) as UTCTimestamp,
          };
        } else {
          // line, trend_line, fibonacci transladam como bloco rígido (deltaPrice + deltaLogical)
          const newP1Logical = (dragState.initialP1.logical ?? 0) + deltaLogical;
          const newP2Logical = dragState.initialP2
            ? (dragState.initialP2.logical ?? 0) + deltaLogical
            : undefined;

          updatedDrawing.p1 = {
            ...dragState.initialP1,
            price: dragState.initialP1.price + deltaPrice,
            logical: newP1Logical,
          };

          if (dragState.initialP2) {
            updatedDrawing.p2 = {
              ...dragState.initialP2,
              price: dragState.initialP2.price + deltaPrice,
              logical: newP2Logical,
            };
          }
        }
      } else if (dragState.handle === 'p1') {
        // Ajuste fino do ponto de ancoragem 1 (rotaciona/estende a linha)
        const timeScale = chartInstance.timeScale();
        const newTime = timeScale.coordinateToTime(currentX);
        updatedDrawing.p1 = {
          ...dragState.initialP1,
          price: Number(currentPrice),
          logical: currentLogical !== null ? Number(currentLogical) : dragState.initialP1.logical,
          time: (newTime ?? dragState.initialP1.time) as UTCTimestamp,
        };
      } else if (dragState.handle === 'p2' && dragState.initialP2) {
        // Ajuste fino do ponto de ancoragem 2
        const timeScale = chartInstance.timeScale();
        const newTime = timeScale.coordinateToTime(currentX);
        updatedDrawing.p2 = {
          ...dragState.initialP2,
          price: Number(currentPrice),
          logical: currentLogical !== null ? Number(currentLogical) : dragState.initialP2.logical,
          time: (newTime ?? dragState.initialP2.time) as UTCTimestamp,
        };
      }

      // Throttling rAF a 60 FPS para máxima fluidez sem lag
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(() => {
          onUpdateDrawing?.(updatedDrawing);
          dragRafRef.current = null;
        });
      }
    };

    const onPointerUp = () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [dragState, drawings, chartInstance, activeSeries, onUpdateDrawing]);

  const getCoordinatesFromEvent = (e: React.MouseEvent<SVGSVGElement>): Point2D | null => {
    if (!chartInstance || !activeSeries) return null;
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeScale = chartInstance.timeScale();
    const logical = timeScale.coordinateToLogical(x);
    const time = timeScale.coordinateToTime(x) as UTCTimestamp | null;
    const price = activeSeries.coordinateToPrice(y);

    if (price === null) return null;

    // Se coordinateToTime retornar null (margem futura à direita ou espaço vazio),
    // preservamos o logical index exato para projeção contínua e zoom/pan
    const fallbackTime = (time ?? Math.floor(Date.now() / 1000)) as UTCTimestamp;
    return {
      time: fallbackTime,
      price: Number(price),
      logical: logical !== null ? Number(logical) : undefined,
    };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeTool || !chartInstance || !activeSeries) return;
    const pt = getCoordinatesFromEvent(e);
    if (!pt) return;

    if (activeTool === 'horizontal_line') {
      const newDrawing: DrawingItem = {
        id: safeRandomUUID(),
        type: 'horizontal_line',
        p1: pt,
        color: activeColor,
        lineWidth: 2,
      };
      onAddDrawing(newDrawing);
      onFinishDrawing();
      return;
    }

    if (activeTool === 'vertical_line') {
      const newDrawing: DrawingItem = {
        id: safeRandomUUID(),
        type: 'vertical_line',
        p1: pt,
        color: activeColor,
        lineWidth: 2,
      };
      onAddDrawing(newDrawing);
      onFinishDrawing();
      return;
    }

    // Ferramentas de 2 pontos (line, trend_line, fibonacci)
    if (!firstPoint) {
      setFirstPoint(pt);
      setPreviewPoint(pt);
    } else {
      const newDrawing: DrawingItem = {
        id: safeRandomUUID(),
        type: activeTool,
        p1: firstPoint,
        p2: pt,
        color: activeColor,
        lineWidth: 2,
      };
      onAddDrawing(newDrawing);
      setFirstPoint(null);
      setPreviewPoint(null);
      onFinishDrawing();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeTool || !firstPoint) return;
    const pt = getCoordinatesFromEvent(e);
    if (!pt) return;
    pendingPointRef.current = pt;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        if (pendingPointRef.current) {
          setPreviewPoint(pendingPointRef.current);
        }
        rafIdRef.current = null;
      });
    }
  };

  // Funções de projeção lógica -> tela
  const getPixelX = (pt: Point2D | UTCTimestamp | null | undefined): number | null => {
    if (!chartInstance || !pt) return null;
    const timeScale = chartInstance.timeScale();

    // 1. Prioridade 1: Logical index (suporta perfeitamente barras passadas, presentes E FUTURAS na margem direita)
    if (typeof pt === 'object' && 'logical' in pt && typeof pt.logical === 'number' && Number.isFinite(pt.logical)) {
      try {
        const coord = timeScale.logicalToCoordinate(Math.round(pt.logical) as any);
        if (coord !== null && Number.isFinite(Number(coord))) {
          return Number(coord);
        }
      } catch { /* ignore */ }
    }

    // 2. Prioridade 2: Conversão exata de tempo via timeToCoordinate
    const timeVal = typeof pt === 'object' && 'time' in pt ? pt.time : (typeof pt === 'number' ? pt : null);
    if (timeVal !== null) {
      try {
        const coord = timeScale.timeToCoordinate(timeVal as UTCTimestamp);
        if (coord !== null && Number.isFinite(Number(coord))) {
          return Number(coord);
        }
      } catch { /* ignore */ }
    }

    return null;
  };

  const getPixelY = (price: number): number | null => {
    if (!activeSeries || !Number.isFinite(price)) return null;
    try {
      const y = activeSeries.priceToCoordinate(price);
      return y !== null && Number.isFinite(Number(y)) ? Number(y) : null;
    } catch {
      return null;
    }
  };

  const isInteractive = Boolean(activeTool);

  return (
    <svg
      ref={svgRef}
      width={containerWidth}
      height={containerHeight}
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: isInteractive ? 20 : 12,
        pointerEvents: isInteractive ? 'auto' : 'none',
        cursor: activeTool ? 'crosshair' : dragState ? 'grabbing' : 'default',
      }}
    >
      {/* Desenhos Concluídos */}
      {drawings.map((d) => {
        const isTargeted = hoveredDrawingId === d.id || selectedDrawingId === d.id;

        if (d.type === 'horizontal_line') {
          const y = getPixelY(d.p1.price);
          if (y === null || y < 0 || y > containerHeight) return null;

          return (
            <g
              key={d.id}
              style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
              onClick={(e) => {
                if (activeTool) return;
                e.stopPropagation();
                setSelectedDrawingId((prev) => (prev === d.id ? null : d.id));
              }}
              onMouseEnter={() => setHoveredDrawingId(d.id)}
              onMouseLeave={() => setHoveredDrawingId(null)}
            >
              {/* Hitbox Transparente de 24px para captura e arraste vertical */}
              <line
                x1={0}
                y1={y}
                x2={containerWidth}
                y2={y}
                stroke="transparent"
                strokeWidth={24}
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'ns-resize' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {/* Traço visível */}
              <line
                x1={0}
                y1={y}
                x2={containerWidth}
                y2={y}
                stroke={d.color}
                strokeWidth={isTargeted ? d.lineWidth + 2 : d.lineWidth}
                strokeDasharray="6 3"
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'ns-resize' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {/* Preço na escala direita (arrastável) */}
              <g
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'ns-resize' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              >
                <rect
                  x={containerWidth - 78}
                  y={y - 11}
                  width={72}
                  height={22}
                  rx={4}
                  fill="#1e293b"
                  stroke={d.color}
                  strokeWidth={isTargeted ? 2 : 1}
                />
                <text
                  x={containerWidth - 42}
                  y={y + 4}
                  fill={d.color}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {d.p1.price.toFixed(2)}
                </text>
              </g>
              {/* Botão de Excluir Proeminente quando com hover ou selecionado */}
              {isTargeted && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDrawing(d.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={42} cy={y} r={12} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                  <text x={42} y={y + 4} fill="#fff" fontSize={12} fontWeight={900} textAnchor="middle">
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        }

        if (d.type === 'vertical_line') {
          const x = getPixelX(d.p1);
          if (x === null || x < 0 || x > containerWidth) return null;

          return (
            <g
              key={d.id}
              style={{ pointerEvents: 'auto', cursor: 'ew-resize' }}
              onClick={(e) => {
                if (activeTool) return;
                e.stopPropagation();
                setSelectedDrawingId((prev) => (prev === d.id ? null : d.id));
              }}
              onMouseEnter={() => setHoveredDrawingId(d.id)}
              onMouseLeave={() => setHoveredDrawingId(null)}
            >
              {/* Hitbox Transparente de 24px com arraste horizontal */}
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={containerHeight}
                stroke="transparent"
                strokeWidth={24}
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'ew-resize' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {/* Traço visível */}
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={containerHeight}
                stroke={d.color}
                strokeWidth={isTargeted ? d.lineWidth + 2 : d.lineWidth}
                strokeDasharray="6 3"
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'ew-resize' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {isTargeted && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDrawing(d.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={x} cy={35} r={12} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                  <text x={x} y={39} fill="#fff" fontSize={12} fontWeight={900} textAnchor="middle">
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        }

        if ((d.type === 'line' || d.type === 'trend_line') && d.p2) {
          const x1 = getPixelX(d.p1);
          const y1 = getPixelY(d.p1.price);
          const x2 = getPixelX(d.p2);
          const y2 = getPixelY(d.p2.price);

          if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const isTrendLine = d.type === 'trend_line';

          // Projeção futura da linha de tendência (raio IQ Option)
          let extendedX = x2;
          let extendedY = y2;
          if (isTrendLine && Math.abs(dx) > 1) {
            extendedX = Math.max(containerWidth + 50, x2 + 350);
            extendedY = y1 + (dy / dx) * (extendedX - x1);
          }

          return (
            <g
              key={d.id}
              style={{ pointerEvents: 'auto', cursor: 'move' }}
              onClick={(e) => {
                if (activeTool) return;
                e.stopPropagation();
                setSelectedDrawingId((prev) => (prev === d.id ? null : d.id));
              }}
              onMouseEnter={() => setHoveredDrawingId(d.id)}
              onMouseLeave={() => setHoveredDrawingId(null)}
            >
              {/* Hitbox Transparente de 24px para arraste do corpo inteiro */}
              <line
                x1={x1}
                y1={y1}
                x2={isTrendLine && Math.abs(dx) > 1 ? extendedX : x2}
                y2={isTrendLine && Math.abs(dx) > 1 ? extendedY : y2}
                stroke="transparent"
                strokeWidth={24}
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'move' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {/* Traço visível principal */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={d.color}
                strokeWidth={isTargeted ? d.lineWidth + 2 : d.lineWidth}
                style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'move' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
              />
              {/* Raio projetado para o futuro em linha de tendência */}
              {isTrendLine && Math.abs(dx) > 1 && (
                <line
                  x1={x2}
                  y1={y2}
                  x2={extendedX}
                  y2={extendedY}
                  stroke={d.color}
                  strokeWidth={isTargeted ? d.lineWidth + 1 : d.lineWidth}
                  strokeDasharray="5 3"
                  strokeOpacity={0.85}
                  style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'move' }}
                  onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
                />
              )}
              {/* Pontos de controle de ancoragem arrastáveis independentes */}
              <circle
                cx={x1}
                cy={y1}
                r={isTargeted ? 7 : 4.5}
                fill={isTargeted ? '#38bdf8' : d.color}
                stroke="#0f172a"
                strokeWidth={isTargeted ? 2 : 1.5}
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'p1')}
              >
                <title>Arrastar e ajustar Ponto 1</title>
              </circle>
              <circle
                cx={x2}
                cy={y2}
                r={isTargeted ? 7 : 4.5}
                fill={isTargeted ? '#38bdf8' : d.color}
                stroke="#0f172a"
                strokeWidth={isTargeted ? 2 : 1.5}
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => handleStartDrag(e, d.id, 'p2')}
              >
                <title>Arrastar e ajustar Ponto 2</title>
              </circle>
              {isTargeted && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDrawing(d.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={midX} cy={midY} r={12} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                  <text
                    x={midX}
                    y={midY + 4}
                    fill="#fff"
                    fontSize={12}
                    fontWeight={900}
                    textAnchor="middle"
                  >
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        }

        if (d.type === 'fibonacci' && d.p2) {
          const x1 = getPixelX(d.p1) ?? 0;
          const x2 = getPixelX(d.p2) ?? containerWidth;
          const minX = Math.min(x1, x2);
          const maxX = Math.max(containerWidth, Math.max(x1, x2) + 200);
          const diffPrice = d.p2.price - d.p1.price;

          return (
            <g
              key={d.id}
              style={{ pointerEvents: 'auto', cursor: 'move' }}
              onClick={(e) => {
                if (activeTool) return;
                e.stopPropagation();
                setSelectedDrawingId((prev) => (prev === d.id ? null : d.id));
              }}
              onMouseEnter={() => setHoveredDrawingId(d.id)}
              onMouseLeave={() => setHoveredDrawingId(null)}
            >
              {FIBONACCI_LEVELS.map((lvl) => {
                const targetPrice = d.p1.price + diffPrice * lvl.level;
                const y = getPixelY(targetPrice);
                if (y === null || y < 0 || y > containerHeight) return null;

                return (
                  <g key={lvl.level}>
                    {/* Hitbox Transparente de 24px por nível arrastável */}
                    <line
                      x1={minX}
                      y1={y}
                      x2={maxX}
                      y2={y}
                      stroke="transparent"
                      strokeWidth={24}
                      style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'move' }}
                      onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
                    />
                    <line
                      x1={minX}
                      y1={y}
                      x2={maxX}
                      y2={y}
                      stroke={lvl.color}
                      strokeWidth={isTargeted ? 2.5 : 1.5}
                      strokeDasharray="4 2"
                      style={{ cursor: dragState?.drawingId === d.id ? 'grabbing' : 'move' }}
                      onMouseDown={(e) => handleStartDrag(e, d.id, 'body')}
                    />
                    <text
                      x={minX + 8}
                      y={y - 4}
                      fill={lvl.color}
                      fontSize={10}
                      fontWeight={800}
                    >
                      {lvl.label} ({targetPrice.toFixed(2)})
                    </text>
                  </g>
                );
              })}

              {/* Pontos de controle de ancoragem arrastáveis para Fibonacci */}
              {isTargeted && (
                <>
                  <circle
                    cx={minX + 16}
                    cy={getPixelY(d.p1.price) ?? 40}
                    r={7}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={2}
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(e) => handleStartDrag(e, d.id, 'p1')}
                  >
                    <title>Arrastar e ajustar nível 0.0%</title>
                  </circle>
                  <circle
                    cx={minX + 16}
                    cy={getPixelY(d.p2.price) ?? 80}
                    r={7}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={2}
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(e) => handleStartDrag(e, d.id, 'p2')}
                  >
                    <title>Arrastar e ajustar nível 100.0%</title>
                  </circle>
                </>
              )}

              {isTargeted && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveDrawing(d.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={minX + 42} cy={getPixelY(d.p1.price) ?? 40} r={12} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                  <text
                    x={minX + 42}
                    y={(getPixelY(d.p1.price) ?? 40) + 4}
                    fill="#fff"
                    fontSize={12}
                    fontWeight={900}
                    textAnchor="middle"
                  >
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        }

        return null;
      })}

      {/* Indicador Visual do Ponto 1 Ancorado */}
      {firstPoint && (
        <g pointerEvents="none">
          {(() => {
            const x1 = getPixelX(firstPoint);
            const y1 = getPixelY(firstPoint.price);
            if (x1 === null || y1 === null) return null;
            return (
              <g>
                <circle cx={x1} cy={y1} r={9} fill={activeColor} fillOpacity={0.25} />
                <circle cx={x1} cy={y1} r={4.5} fill={activeColor} stroke="#ffffff" strokeWidth={1} />
                <rect x={x1 + 10} y={y1 - 18} width={180} height={20} rx={4} fill="#0f172a" stroke={activeColor} strokeWidth={1} />
                <text x={x1 + 18} y={y1 - 5} fill="#38bdf8" fontSize={10} fontWeight={800}>
                  Ponto 1 fixado (clique o Ponto 2)
                </text>
              </g>
            );
          })()}
        </g>
      )}

      {/* Preview em Tempo Real de Linha Durante Criação */}
      {firstPoint && previewPoint && (
        <g pointerEvents="none">
          {(() => {
            const x1 = getPixelX(firstPoint);
            const y1 = getPixelY(firstPoint.price);
            const x2 = getPixelX(previewPoint);
            const y2 = getPixelY(previewPoint.price);

            if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const isTrendLine = activeTool === 'trend_line';

            let extendedX = x2;
            let extendedY = y2;
            if (isTrendLine && Math.abs(dx) > 1) {
              extendedX = Math.max(containerWidth + 50, x2 + 350);
              extendedY = y1 + (dy / dx) * (extendedX - x1);
            }

            return (
              <>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={activeColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                {isTrendLine && Math.abs(dx) > 1 && (
                  <line
                    x1={x2}
                    y1={y2}
                    x2={extendedX}
                    y2={extendedY}
                    stroke={activeColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                  />
                )}
                <circle cx={x1} cy={y1} r={5} fill={activeColor} stroke="#ffffff" strokeWidth={1} />
                <circle cx={x2} cy={y2} r={5} fill={activeColor} stroke="#ffffff" strokeWidth={1} />
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
