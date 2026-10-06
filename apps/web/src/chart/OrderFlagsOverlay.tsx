import { useEffect, useState } from 'react';
import type { ISeriesApi } from 'lightweight-charts';
import type { Contract } from '../api/client';
import { formatMinor } from '../lib/money';

export interface OrderFlagsOverlayProps {
  contracts: Contract[];
  currentPrice: number | null;
  containerWidth: number;
  containerHeight: number;
  activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null;
}

export function OrderFlagsOverlay({
  contracts,
  currentPrice,
  containerWidth,
  containerHeight,
  activeSeries,
}: OrderFlagsOverlayProps) {
  const [now, setNow] = useState(Date.now());

  // Atualizar contagem regressiva em tempo real a cada 250ms
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (contracts.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  // Filtrar apenas contratos abertos
  const openContracts = contracts.filter((c) => c.status === 'OPEN');
  if (openContracts.length === 0) return null;

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
      {openContracts.map((contract, index) => {
        const strikePrice = Number(contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0);
        const isUp = contract.direction === 'UP';
        const stakeMinor = Number(contract.stake_minor);

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

        const baseColor = isUp ? '#00e676' : '#ff3d71';
        const flagBg = isWinning
          ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.95), rgba(0, 180, 90, 0.95))'
          : 'linear-gradient(135deg, rgba(255, 61, 113, 0.95), rgba(200, 30, 75, 0.95))';

        return (
          <div
            key={contract.id}
            className="order-strike-flag"
            data-testid={`order-flag-${contract.id}`}
            style={{
              position: 'absolute',
              top: `${topY}px`,
              right: '80px',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: flagBg,
              color: '#ffffff',
              boxShadow: `0 4px 15px ${isWinning ? 'rgba(0, 230, 118, 0.45)' : 'rgba(255, 61, 113, 0.45)'}`,
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: "'Space Grotesk', sans-serif",
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
              cursor: 'default',
              transition: 'top 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              border: `1px solid ${baseColor}`,
            }}
          >
            {/* Ícone de Direção */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.25)',
                fontSize: '10px',
              }}
            >
              {isUp ? '▲' : '▼'}
            </span>

            {/* Valor do Stake */}
            <span>{formatMinor(stakeMinor)}</span>

            {/* Cotação de Entrada (Strike) */}
            <span
              style={{
                fontSize: '10px',
                opacity: 0.9,
                borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
                paddingLeft: '6px',
              }}
            >
              @{strikePrice.toFixed(4)}
            </span>

            {/* Tempo Restante */}
            <span
              style={{
                fontSize: '10px',
                padding: '2px 5px',
                borderRadius: '4px',
                background: 'rgba(0, 0, 0, 0.35)',
              }}
            >
              {secondsLeft}s
            </span>
          </div>
        );
      })}
    </div>
  );
}
