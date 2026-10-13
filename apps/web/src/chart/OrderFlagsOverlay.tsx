import { useEffect, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Contract } from '../api/client';
import { formatMinor } from '../lib/money';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { ExpirationResultPin } from './ExpirationResultPin';
import { getAssetMeta } from '../catalog/assets';

export interface OrderFlagsOverlayProps {
  contracts: Contract[];
  currentPrice: number | null;
  containerWidth: number;
  containerHeight: number;
  activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null;
  chartInstance?: IChartApi | null;
}

export function OrderFlagsOverlay({
  contracts,
  currentPrice,
  containerWidth,
  containerHeight,
  activeSeries,
  chartInstance,
}: OrderFlagsOverlayProps) {
  const [now, setNow] = useState(Date.now());
  const [, setRedrawKey] = useState(0);
  const [dismissedPinIds, setDismissedPinIds] = useState<Set<string>>(new Set());
  const isBinmax = isNewTraderoomEnabled();

  // Atualizar contagem regressiva em tempo real a cada 250ms (G-09)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  // Forçar redraw síncrono em zoom/pan da escala do Lightweight Charts (G-05)
  useEffect(() => {
    if (!chartInstance) return;
    try {
      const timeScale = chartInstance.timeScale();
      const handleRangeChange = () => {
        setRedrawKey((k) => k + 1);
      };
      timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
      return () => {
        try {
          timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
        } catch { /* ignore */ }
      };
    } catch {
      return undefined;
    }
  }, [chartInstance]);

  if (contracts.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  // Filtrar contratos abertos e liquidados
  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  const settledContracts = isBinmax
    ? contracts.filter((c) => c.status === 'SETTLED' && !dismissedPinIds.has(c.id))
    : [];

  if (openContracts.length === 0 && settledContracts.length === 0) return null;

  // Largura da escala de preço lateral (~68px)
  const rightScaleWidth = 68;
  const lineEndX = Math.max(100, containerWidth - rightScaleWidth);

  return (
    <div
      className="order-flags-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        pointerEvents: 'none',
        zIndex: 8,
        overflow: 'hidden',
      }}
    >
      {/* Camada SVG de Alta Fidelidade: Linhas Horizontais de Strike e Glow (Subetapa 7.2) */}
      {openContracts.length > 0 && (
        <svg
          className="order-strike-lines-svg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {openContracts.map((contract, index) => {
            const rawPrice = contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0;
            const strikePrice = Number(rawPrice);
            const isUp = contract.direction === 'UP';
            const baseColor = isUp ? (isBinmax ? '#22C47A' : '#00e676') : (isBinmax ? '#F2545B' : '#ff3d71');

            let yCoord: number | null = null;
            if (activeSeries && Number.isFinite(strikePrice)) {
              try {
                const coord = activeSeries.priceToCoordinate(strikePrice);
                if (typeof coord === 'number' && Number.isFinite(coord)) {
                  yCoord = coord;
                }
              } catch {
                yCoord = null;
              }
            }

            const topY = yCoord !== null
              ? Math.max(20, Math.min(containerHeight - 20, yCoord))
              : 80 + index * 42;

            return (
              <g key={`strike-svg-${contract.id}`} className="strike-line-group">
                {/* Linha Tracejada Oficial da Operação */}
                <line
                  x1={0}
                  y1={topY}
                  x2={lineEndX}
                  y2={topY}
                  stroke={baseColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Badges de Operação Flutuantes & Marcadores de Taxa */}
      {openContracts.map((contract, index) => {
        const rawPrice = contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0;
        const strikePrice = Number(rawPrice);
        const isUp = contract.direction === 'UP';
        const stakeMinor = Number(contract.stake_minor);
        const assetMeta = getAssetMeta(contract.symbol || '');
        const strikeFormatted = Number.isFinite(strikePrice) && strikePrice > 0
          ? strikePrice.toFixed(assetMeta.precision)
          : String(rawPrice);

        // Obter coordenada Y precisa da linha de strike no canvas
        let yCoord: number | null = null;
        if (activeSeries && Number.isFinite(strikePrice)) {
          try {
            const coord = activeSeries.priceToCoordinate(strikePrice);
            if (typeof coord === 'number' && Number.isFinite(coord)) {
              yCoord = coord;
            }
          } catch {
            yCoord = null;
          }
        }

        // Se a cotação estiver fora do viewport do gráfico, posicionar de forma empilhada limpa
        const topY = yCoord !== null
          ? Math.max(50, Math.min(containerHeight - 50, yCoord))
          : 80 + index * 42;

        // Análise de status: In The Money (ITM) vs Out of The Money (OTM)
        let isWinning = false;
        if (currentPrice !== null && Number.isFinite(currentPrice)) {
          if (isUp) {
            isWinning = currentPrice > strikePrice;
          } else {
            isWinning = currentPrice < strikePrice;
          }
        }

        const expiresAt = Date.parse(contract.expires_at);
        const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));

        const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
        const seconds = (secondsLeft % 60).toString().padStart(2, '0');
        const timeFormatted = isBinmax ? `${minutes}:${seconds}` : `${secondsLeft}s`;

        const baseColor = isUp ? (isBinmax ? '#22C47A' : '#00e676') : (isBinmax ? '#F2545B' : '#ff3d71');
        const flagBg = isBinmax
          ? 'rgba(18, 24, 38, 0.94)'
          : (isWinning
            ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.95), rgba(0, 180, 90, 0.95))'
            : 'linear-gradient(135deg, rgba(255, 61, 113, 0.95), rgba(200, 30, 75, 0.95))');

        return (
          <div key={`contract-group-${contract.id}`}>
            {/* Tag da Taxa de Abertura na Escala de Preço Lateral Direita */}
            <div
              className="axis-strike-tag"
              data-testid={`axis-strike-${contract.id}`}
              style={{
                position: 'absolute',
                top: `${topY}px`,
                right: '4px',
                transform: 'translateY(-50%)',
                background: baseColor,
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 800,
                fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif",
                textAlign: 'center',
                padding: '2px 5px',
                borderRadius: '3px',
                zIndex: 9,
                pointerEvents: 'none',
                letterSpacing: '0.2px',
              }}
            >
              {strikeFormatted}
            </div>

            {/* Badge Principal da Ordem no Gráfico */}
            <div
              className="order-strike-flag"
              data-testid={`order-flag-${contract.id}`}
              style={{
                position: 'absolute',
                top: `${topY}px`,
                right: isBinmax ? '76px' : '80px',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: isBinmax ? '3px 8px' : '4px 10px',
                borderRadius: '6px',
                background: flagBg,
                backdropFilter: isBinmax ? 'blur(8px)' : undefined,
                color: '#ffffff',
                boxShadow: isBinmax
                  ? '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.2)'
                  : (isWinning ? '0 4px 15px rgba(0, 230, 118, 0.45)' : '0 4px 15px rgba(255, 61, 113, 0.45)'),
                fontSize: '11px',
                fontWeight: 800,
                fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif",
                whiteSpace: 'nowrap',
                pointerEvents: 'auto',
                cursor: 'default',
                transition: 'top 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                border: `1px solid ${baseColor}`,
              }}
            >
              {/* Ícone de Direção */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isBinmax ? '18px' : '16px',
                  height: isBinmax ? '18px' : '16px',
                  borderRadius: '50%',
                  background: isBinmax ? baseColor : 'rgba(0, 0, 0, 0.25)',
                  color: '#ffffff',
                  fontSize: isBinmax ? '10px' : '9px',
                  fontWeight: 900,
                }}
              >
                {isUp ? '▲' : '▼'}
              </span>

              {/* Valor do Stake */}
              <span
                data-testid={`flag-stake-${contract.id}`}
                style={{
                  color: '#F4F5F7',
                  fontWeight: 800,
                  fontSize: isBinmax ? '12px' : '11px',
                  letterSpacing: '0.2px',
                }}
              >
                {isBinmax ? `$${Math.round(stakeMinor / 100)}` : formatMinor(stakeMinor)}
              </span>

              {/* Divisor Vertical Elegante na Binmax */}
              {isBinmax && (
                <span
                  style={{
                    width: '1px',
                    height: '12px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    margin: '0 1px',
                  }}
                />
              )}

              {/* Taxa Numérica de Abertura (Strike Price Oficial) */}
              <span
                data-testid={`flag-strike-${contract.id}`}
                style={{
                  fontSize: '10.5px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: baseColor,
                  fontWeight: 800,
                  letterSpacing: '0.2px',
                }}
                title="Taxa da Operação"
              >
                @{strikeFormatted}
              </span>

              {/* Divisor Vertical Elegante na Binmax */}
              {isBinmax && (
                <span
                  style={{
                    width: '1px',
                    height: '12px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    margin: '0 1px',
                  }}
                />
              )}

              {/* Tempo Restante (MM:SS na Binmax) */}
              <span
                data-testid={`flag-time-${contract.id}`}
                style={{
                  fontSize: '10px',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: isBinmax ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.35)',
                  color: isBinmax ? '#8A92A1' : '#ffffff',
                  fontWeight: 700,
                }}
              >
                {timeFormatted}
              </span>
            </div>
          </div>
        );
      })}

      {/* Pins de Resultado In-Chart (Fidelidade IQ Option) */}
      {settledContracts.map((contract) => {
        const isWin = contract.result === 'WIN';
        const stakeMin = Number(contract.stake_minor || 1000);
        const payoutMin = contract.payout_minor
          ? Number(contract.payout_minor)
          : Math.round(stakeMin * 0.85);
        const amountFormatted = isWin
          ? `+$${(payoutMin / 100).toFixed(2)}`
          : `-$${(stakeMin / 100).toFixed(2)}`;

        let yCoord = Math.round(containerHeight / 2);
        const exitPrice = Number(contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0);
        if (activeSeries && Number.isFinite(exitPrice)) {
          try {
            const coord = activeSeries.priceToCoordinate(exitPrice);
            if (typeof coord === 'number' && Number.isFinite(coord)) {
              yCoord = coord;
            }
          } catch {
            // fallback
          }
        }

        const safeY = Math.max(60, Math.min(containerHeight - 60, yCoord));
        const xCoord = Math.max(80, containerWidth - 160);

        return (
          <ExpirationResultPin
            key={contract.id}
            result={isWin ? 'WIN' : contract.result === 'LOSS' ? 'LOSS' : 'DRAW'}
            amountFormatted={amountFormatted}
            x={xCoord}
            y={safeY}
            onClose={() => setDismissedPinIds((prev) => new Set([...prev, contract.id]))}
          />
        );
      })}
    </div>
  );
}
