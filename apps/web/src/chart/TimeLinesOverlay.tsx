import { useEffect, useState } from 'react';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';

export interface TimeLinesOverlayProps {
  containerWidth: number;
  containerHeight: number;
  chartInstance: IChartApi | null;
  latestCandleTime: UTCTimestamp | null;
  tickTimestamp?: string | null;
}

export function TimeLinesOverlay({
  containerWidth,
  containerHeight,
  chartInstance,
  latestCandleTime,
  tickTimestamp,
}: TimeLinesOverlayProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [purchaseSecondsRemaining, setPurchaseSecondsRemaining] = useState<number>(30);
  const [isPurchaseLocked, setIsPurchaseLocked] = useState<boolean>(false);

  // Sincronização temporal de alta fidelidade
  useEffect(() => {
    const updateCountdown = () => {
      const now = tickTimestamp ? Date.parse(tickTimestamp) : Date.now();
      const currentSec = Math.floor(now / 1000) % 60;
      
      // Contagem regressiva até a expiração (:00s do próximo minuto)
      const remExp = 60 - currentSec;
      setSecondsRemaining(remExp === 0 ? 60 : remExp);

      // Contagem regressiva até a trava de compra (:30s da vela atual)
      const remPurchase = 30 - currentSec;
      if (remPurchase > 0) {
        setPurchaseSecondsRemaining(remPurchase);
        setIsPurchaseLocked(false);
      } else {
        // Trava ativa para a vela em curso
        setPurchaseSecondsRemaining(0);
        setIsPurchaseLocked(true);
      }
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

  // Obter coordenada X da vela mais recente caso disponível
  let xCandle: number | null = null;
  if (chartInstance && latestCandleTime) {
    try {
      const coord = chartInstance.timeScale().timeToCoordinate(latestCandleTime);
      if (typeof coord === 'number' && Number.isFinite(coord)) {
        xCandle = coord;
      }
    } catch {
      xCandle = null;
    }
  }

  // Cálculo das coordenadas horizontais X
  let xExpiration: number;
  let xPurchase: number;

  if (xCandle !== null && xCandle > 40 && xCandle < effectiveWidth - 30) {
    const forwardSpace = Math.min(220, Math.max(70, (effectiveWidth - xCandle) * 0.85));
    xExpiration = Math.min(effectiveWidth - 15, xCandle + forwardSpace);
    xPurchase = Math.min(xExpiration - 25, xCandle + forwardSpace * 0.52);
  } else {
    // Projeção responsiva quando o gráfico não tem coordenadas visíveis
    xExpiration = Math.round(effectiveWidth * 0.84);
    xPurchase = Math.round(effectiveWidth * 0.68);
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
      {/* 1. Linha Branca Tracejada: Hora de Compra */}
      <div
        className="time-line-purchase"
        data-testid="purchase-time-line"
        style={{
          position: 'absolute',
          left: `${xPurchase}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          borderLeft: '1px dashed rgba(255, 255, 255, 0.75)',
        }}
      >
        {/* Tag Superior: Hora de Compra */}
        <div
          className="time-tag-purchase"
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            transform: 'translateX(-50%)',
            background: isPurchaseLocked ? 'rgba(255, 255, 255, 0.4)' : '#ffffff',
            color: '#080e1d',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⏱️</span>
          <span>{isPurchaseLocked ? 'COMPRA TRAVADA' : `HORA DE COMPRA (${purchaseSecondsRemaining}s)`}</span>
        </div>
      </div>

      {/* 2. Linha Vermelha: Expiração */}
      <div
        className="time-line-expiration"
        data-testid="expiration-time-line"
        style={{
          position: 'absolute',
          left: `${xExpiration}px`,
          top: 0,
          bottom: 0,
          width: '2px',
          background: '#ff3d71',
          boxShadow: '0 0 10px rgba(255, 61, 113, 0.75)',
        }}
      >
        {/* Tag Superior: Expiração com Contagem Regressiva */}
        <div
          className="time-tag-expiration"
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            transform: 'translateX(-50%)',
            background: '#ff3d71',
            color: '#ffffff',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(255, 61, 113, 0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '8px' }}>🔴</span>
          <span>EXPIRAÇÃO 00:{formattedSeconds}</span>
        </div>
      </div>
    </div>
  );
}
