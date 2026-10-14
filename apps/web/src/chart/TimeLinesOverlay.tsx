import { useEffect, useState } from 'react';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { isTraderoomPolishEnabled } from '../lib/traderoom-polish';
import { timeframeSeconds, type Timeframe } from './candle-adapter';

export interface TimeCountdowns {
  secondsRemaining: number;
  purchaseSecondsRemaining: number;
  isPurchaseLocked: boolean;
}

/** Contagens da vela de 1 minuto: compra trava aos :30, expiração aos :00. */
export function computeTimeCountdowns(nowMs: number): TimeCountdowns {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const currentSec = Math.floor(safeNow / 1000) % 60;
  const remExp = 60 - currentSec;
  const remPurchase = 30 - currentSec;
  return {
    secondsRemaining: remExp === 0 ? 60 : remExp,
    purchaseSecondsRemaining: remPurchase > 0 ? remPurchase : 0,
    isPurchaseLocked: remPurchase <= 0,
  };
}

/** Única pulsação permitida pelo guia: os últimos 5 s antes da trava de compra. */
export function shouldPulseCountdown(secondsLeft: number): boolean {
  return secondsLeft > 0 && secondsLeft <= 5;
}

export interface TimeLinesOverlayProps {
  containerWidth: number;
  containerHeight: number;
  chartInstance: IChartApi | null;
  latestCandleTime: UTCTimestamp | null;
  tickTimestamp?: string | null;
  timeframe?: Timeframe;
  hideTopTags?: boolean;
}

export function TimeLinesOverlay({
  containerWidth,
  containerHeight,
  chartInstance,
  latestCandleTime,
  tickTimestamp,
  timeframe = '1m',
  hideTopTags = false,
}: TimeLinesOverlayProps) {
  const isBinmax = isNewTraderoomEnabled();
  // Acabamento profissional (TRADEROOM_POLISH). Desligada = overlay idêntico ao anterior.
  const polish = isBinmax && isTraderoomPolishEnabled();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [purchaseSecondsRemaining, setPurchaseSecondsRemaining] = useState<number>(30);
  const [isPurchaseLocked, setIsPurchaseLocked] = useState<boolean>(false);

  // Sincronização temporal de alta fidelidade
  useEffect(() => {
    const updateCountdown = () => {
      const parsed = tickTimestamp ? Date.parse(tickTimestamp) : Date.now();
      const next = computeTimeCountdowns(parsed);
      setSecondsRemaining(next.secondsRemaining);
      setPurchaseSecondsRemaining(next.purchaseSecondsRemaining);
      setIsPurchaseLocked(next.isPurchaseLocked);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 250);
    return () => clearInterval(interval);
  }, [tickTimestamp]);

  if (containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  // Margem da escala de preço lateral direita (~68px)
  const rightScaleWidth = 68;
  const effectiveWidth = Math.max(150, containerWidth - rightScaleWidth);

  // Obter coordenada X da vela mais recente e espaçamento de barra (barSpacing) caso disponível
  let xCandle: number | null = null;
  let barSpacing = 14;
  if (chartInstance && latestCandleTime) {
    try {
      const timeScale = chartInstance.timeScale();
      const coord = timeScale.timeToCoordinate(latestCandleTime);
      if (typeof coord === 'number' && Number.isFinite(coord)) {
        xCandle = coord;
        const logical = timeScale.coordinateToLogical(coord);
        if (logical !== null) {
          const nextX = timeScale.logicalToCoordinate(((logical as number) + 1) as any);
          if (nextX !== null && Number.isFinite(nextX) && nextX > coord) {
            barSpacing = Math.max(4, Math.min(100, nextX - coord));
          }
        }
      }
    } catch {
      xCandle = null;
    }
  }

  // Cálculo das coordenadas horizontais X geometricamente ancoradas
  let xExpiration: number;
  let xPurchase: number;

  const maxExpirationX = Math.max(80, effectiveWidth - 65);
  const tfSec = timeframe ? timeframeSeconds(timeframe) : 60;

  if (xCandle !== null && xCandle > 10 && xCandle < effectiveWidth - 20) {
    const barsAheadExp = Math.max(0.1, secondsRemaining / tfSec);
    const calculatedExpX = xCandle + barsAheadExp * barSpacing;
    xExpiration = Math.min(maxExpirationX, calculatedExpX);

    if (isPurchaseLocked || purchaseSecondsRemaining <= 0) {
      xPurchase = xCandle;
    } else {
      const barsAheadPurchase = Math.max(0.05, purchaseSecondsRemaining / tfSec);
      const calculatedPurchX = xCandle + barsAheadPurchase * barSpacing;
      const maxPurchaseX = Math.max(xCandle, xExpiration - 15);
      xPurchase = Math.max(xCandle, Math.min(maxPurchaseX, calculatedPurchX));
    }
  } else {
    // Projeção responsiva quando o gráfico não tem coordenadas visíveis
    xExpiration = Math.min(maxExpirationX, Math.round(effectiveWidth * 0.84));
    xPurchase = Math.min(xExpiration - 25, Math.round(effectiveWidth * 0.68));
  }

  const formattedSeconds = secondsRemaining.toString().padStart(2, '0');

  return (
    <div
      className="time-lines-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {/* 1. Linha Branca Pontilhada: Hora de Compra (C10) */}
      <div
        className="time-line-purchase"
        data-testid="purchase-time-line"
        style={{
          position: 'absolute',
          left: `${xPurchase}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          borderLeft: isBinmax ? '1px dotted rgba(244, 245, 247, 0.85)' : '1px dashed rgba(255, 255, 255, 0.75)',
        }}
      >
        {/* Tag Superior: Hora de Compra (TRADEROOM_POLISH: rótulo em 2 linhas, sem caixa, como C10) */}
        {polish && !hideTopTags && (
          <div
            className="time-tag-purchase"
            data-testid="time-tag-purchase"
            style={{
              position: 'absolute',
              top: '16px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.2, color: 'var(--text-muted)', textAlign: 'right', letterSpacing: '0.02em' }}>
              HORA DE<br />COMPRA
            </span>
            <strong
              data-testid="purchase-countdown"
              className={shouldPulseCountdown(purchaseSecondsRemaining) ? 'bm-countdown-pulse' : undefined}
              style={{
                fontSize: '20px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: isPurchaseLocked ? 'var(--text-muted)' : 'var(--text-strong)',
              }}
            >
              00:{purchaseSecondsRemaining.toString().padStart(2, '0')}
            </strong>
          </div>
        )}
        {!polish && !hideTopTags && (
          <div
            className="time-tag-purchase"
            data-testid="time-tag-purchase"
            style={{
              position: 'absolute',
              top: isBinmax ? '24px' : '40px',
              right: isBinmax ? '8px' : undefined,
              left: isBinmax ? undefined : 0,
              transform: isBinmax ? undefined : 'translateX(-50%)',
              background: isBinmax ? 'rgba(18, 24, 38, 0.96)' : (isPurchaseLocked ? 'rgba(255, 255, 255, 0.4)' : '#ffffff'),
              border: isBinmax ? '1px solid rgba(244, 245, 247, 0.15)' : 'none',
              color: isBinmax ? '#F4F5F7' : '#080e1d',
              borderRadius: '4px',
              padding: isBinmax ? '4px 8px' : '3px 8px',
              fontSize: '10px',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: isBinmax ? 'column' : 'row',
              alignItems: isBinmax ? 'flex-end' : 'center',
              gap: isBinmax ? '2px' : '4px',
              fontFamily: isBinmax ? "'Geist', sans-serif" : undefined,
            }}
          >
            {isBinmax ? (
              <>
                <span style={{ fontSize: '9px', color: '#8A92A1', fontWeight: 600 }}>HORA DE COMPRA</span>
                <strong style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: '#F4F5F7' }}>
                  00:{purchaseSecondsRemaining.toString().padStart(2, '0')}
                </strong>
              </>
            ) : (
              <>
                <span>⏱️</span>
                <span>{isPurchaseLocked ? 'COMPRA TRAVADA' : `HORA DE COMPRA (${purchaseSecondsRemaining}s)`}</span>
              </>
            )}
          </div>
        )}

        {/* Ícone no pé da linha (C10) */}
        {isBinmax && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: 0,
              transform: 'translateX(-50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#F4F5F7',
              color: '#0D0F14',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}
            title="Hora de compra"
          >
            <svg width={10} height={10} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm.5 4.5v3.25l2.5 1.5-.75 1.25L7 8.75V4.5z"/>
            </svg>
          </div>
        )}
      </div>

      {/* 2. Linha Vermelha Contínua: Expiração (C11) */}
      <div
        className="time-line-expiration"
        data-testid="expiration-time-line"
        style={{
          position: 'absolute',
          left: `${xExpiration}px`,
          top: 0,
          bottom: 0,
          width: polish ? '1px' : isBinmax ? '1.5px' : '2px',
          background: polish ? 'var(--loss)' : isBinmax ? '#E5484D' : '#ff3d71',
          boxShadow: polish ? 'none' : isBinmax ? '0 0 6px rgba(229, 72, 77, 0.4)' : '0 0 10px rgba(255, 61, 113, 0.75)',
        }}
      >
        {/* Tag Superior: Expiração com Contagem Regressiva (some com TRADEROOM_POLISH: evita colisão com a hora de compra) */}
        {!polish && !hideTopTags && (
          <div
            className="time-tag-expiration"
            data-testid="time-tag-expiration"
            style={{
              position: 'absolute',
              top: isBinmax ? '56px' : '40px',
              left: 0,
              transform: 'translateX(-50%)',
              background: isBinmax ? 'rgba(15, 20, 28, 0.92)' : '#ff3d71',
              border: isBinmax ? '1px solid rgba(229, 72, 77, 0.4)' : 'none',
              color: isBinmax ? '#E5484D' : '#ffffff',
              borderRadius: '6px',
              padding: isBinmax ? '3px 8px' : '2px 8px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              boxShadow: isBinmax ? '0 2px 8px rgba(0, 0, 0, 0.5)' : '0 2px 10px rgba(255, 61, 113, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: isBinmax ? "'Geist Mono', monospace" : undefined,
            }}
          >
            {isBinmax ? (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E5484D', boxShadow: '0 0 4px #E5484D', flexShrink: 0 }} />
                <span>EXPIRACIÓN 00:{formattedSeconds}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '8px' }}>🔴</span>
                <span>EXPIRACIÓN 00:{formattedSeconds}</span>
              </>
            )}
          </div>
        )}

        {/* Ícone no pé da linha (C11) */}
        {isBinmax && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: 0,
              transform: 'translateX(-50%)',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#E5484D',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }}
            title="Expiración"
          >
            <span style={{ display: 'none' }} aria-hidden="true">🚩</span>
            <svg width={8} height={8} viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 2v12h1.5V9H13l-2-3.5L13 2H3z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
