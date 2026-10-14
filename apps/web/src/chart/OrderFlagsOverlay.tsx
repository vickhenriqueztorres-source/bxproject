import React, { useEffect, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Contract } from '../api/client';
import { formatMinor } from '../lib/money';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { ExpirationResultPin } from './ExpirationResultPin';
import { getAssetMeta } from '../catalog/assets';
import { isTraderoomPolishEnabled } from '../lib/traderoom-polish';

export interface OrderFlagsOverlayProps {
  contracts: Contract[];
  currentPrice: number | null;
  containerWidth: number;
  containerHeight: number;
  activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null;
  chartInstance?: IChartApi | null;
}

/** Posições abertas com a mesma direção e o mesmo strike, desenhadas como uma linha só. */
export interface FlagGroup {
  key: string;
  direction: 'UP' | 'DOWN';
  strike: number;
  strikeFormatted: string;
  count: number;
  /** Stake de cada contrato quando todos são iguais; null quando variam. */
  stakeMinor: number | null;
  totalStakeMinor: number;
  isWinning: boolean;
  /** Segundos até a expiração mais próxima do grupo. */
  secondsLeft: number;
}

/** Máximo de etiquetas visíveis com TRADEROOM_POLISH; o resto vira "+N". */
const MAX_POLISH_FLAGS = 3;
const FLAG_MIN_GAP_PX = 18;

export function groupOpenContracts(contracts: Contract[], currentPrice: number | null, nowMs: number): FlagGroup[] {
  const price = currentPrice !== null && Number.isFinite(currentPrice) ? currentPrice : null;
  const groups = new Map<string, FlagGroup>();

  for (const c of contracts) {
    if (c.status !== 'OPEN') continue;
    const strike = Number(c.strike_price ?? c.entry_price);
    const precision = getAssetMeta(c.symbol || '').precision;
    const strikeFormatted = Number.isFinite(strike) ? strike.toFixed(precision) : '—';
    const direction: 'UP' | 'DOWN' = c.direction === 'DOWN' ? 'DOWN' : 'UP';
    const key = `${direction}:${strikeFormatted}`;
    const rawStake = Number(c.stake_minor);
    const stakeMinor = Number.isFinite(rawStake) && rawStake > 0 ? rawStake : 0;
    const expMs = Date.parse(c.expires_at);
    const secondsLeft = Number.isFinite(expMs) ? Math.max(0, Math.ceil((expMs - nowMs) / 1000)) : 0;
    const isWinning = price !== null && Number.isFinite(strike) && (direction === 'UP' ? price > strike : price < strike);

    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalStakeMinor += stakeMinor;
      if (existing.stakeMinor !== stakeMinor) existing.stakeMinor = null;
      existing.secondsLeft = Math.min(existing.secondsLeft, secondsLeft);
    } else {
      groups.set(key, { key, direction, strike, strikeFormatted, count: 1, stakeMinor, totalStakeMinor: stakeMinor, isWinning, secondsLeft });
    }
  }

  return [...groups.values()];
}

/**
 * Posições verticais das etiquetas sem sobreposição: mantém a ordem, separa por minGap
 * e respeita [minY, maxY]. Devolve na mesma ordem da entrada.
 */
export function layoutFlagRows(ys: number[], minGap: number, minY: number, maxY: number): number[] {
  const order = ys
    .map((y, i) => ({ y: Number.isFinite(y) ? y : minY, i }))
    .sort((a, b) => a.y - b.y);
  const rows = order.map((o) => Math.min(maxY, Math.max(minY, o.y)));

  for (let k = 1; k < rows.length; k++) rows[k] = Math.max(rows[k], rows[k - 1] + minGap);
  if (rows.length > 0 && rows[rows.length - 1] > maxY) {
    rows[rows.length - 1] = maxY;
    for (let k = rows.length - 2; k >= 0; k--) rows[k] = Math.min(rows[k], rows[k + 1] - minGap);
  }
  if (rows.length > 0 && rows[0] < minY) {
    rows[0] = minY;
    for (let k = 1; k < rows.length; k++) rows[k] = Math.max(rows[k], rows[k - 1] + minGap);
  }

  const result: number[] = new Array(ys.length);
  order.forEach((o, k) => { result[o.i] = rows[k]; });
  return result;
}

function formatGroupStake(g: FlagGroup): string {
  const dollars = (minor: number) => (minor % 100 === 0 ? `$${minor / 100}` : `$${(minor / 100).toFixed(2)}`);
  if (g.stakeMinor === null) return `${g.count} · ${dollars(g.totalStakeMinor)}`;
  return g.count > 1 ? `${g.count} × ${dollars(g.stakeMinor)}` : dollars(g.stakeMinor);
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
  // Acabamento profissional (TRADEROOM_POLISH). Desligada = overlay idêntico ao anterior.
  const polish = isBinmax && isTraderoomPolishEnabled();

  // Atualizar contagem regressiva em tempo real a cada 250ms (G-09)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  // Forçar redraw síncrono em zoom/pan da escala do Lightweight Charts (G-05)
  useEffect(() => {
    if (!chartInstance) return;
    try {
      let timeScale: any = chartInstance.timeScale();
      const handleRangeChange = () => {
        setRedrawKey((k) => k + 1);
      };
      timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
      return () => {
        try {
          timeScale?.unsubscribeVisibleTimeRangeChange(handleRangeChange);
        } catch { /* ignore */ }
        timeScale = null;
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

  // TRADEROOM_POLISH: uma linha fina por strike, no máximo 3 etiquetas sem sobreposição e "+N".
  let polishLayer: React.ReactNode = null;
  if (polish && openContracts.length > 0) {
    const groups = groupOpenContracts(openContracts, currentPrice, now);
    const lineYs = groups.map((g, i) => {
      let y: number | null = null;
      if (activeSeries && Number.isFinite(g.strike)) {
        try {
          const coord = activeSeries.priceToCoordinate(g.strike);
          if (typeof coord === 'number' && Number.isFinite(coord)) y = coord;
        } catch {
          y = null;
        }
      }
      return y !== null ? Math.max(20, Math.min(containerHeight - 20, y)) : 80 + i * 42;
    });
    const tagYs = layoutFlagRows(lineYs, FLAG_MIN_GAP_PX, 12, containerHeight - 12);
    // Etiquetas visíveis: as que expiram primeiro
    const visible = groups
      .map((g, i) => ({ g, y: lineYs[i] }))
      .sort((a, b) => a.g.secondsLeft - b.g.secondsLeft)
      .slice(0, MAX_POLISH_FLAGS);
    const flagYs = layoutFlagRows(visible.map((v) => v.y), FLAG_MIN_GAP_PX, 24, containerHeight - 48);
    const hiddenCount = groups.length - visible.length;
    const stateColor = (g: FlagGroup) => (g.isWinning ? 'var(--profit)' : 'var(--loss)');

    polishLayer = (
      <>
        <svg
          className="order-strike-lines-svg"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {groups.map((g, i) => (
            <line
              key={`strike-line-${g.key}`}
              x1={0}
              y1={lineYs[i]}
              x2={lineEndX}
              y2={lineYs[i]}
              stroke={stateColor(g)}
              strokeOpacity={0.7}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ))}
        </svg>

        {groups.map((g, i) => (
          <div
            key={`strike-tag-${g.key}`}
            className="axis-strike-tag"
            data-testid={`axis-strike-group-${g.key}`}
            style={{
              position: 'absolute',
              top: `${tagYs[i]}px`,
              right: '4px',
              transform: 'translateY(-50%)',
              background: stateColor(g),
              color: 'var(--bg-0)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              padding: '2px 5px',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}
          >
            {g.strikeFormatted}
          </div>
        ))}

        {visible.map(({ g }, k) => {
          const mins = Math.floor(g.secondsLeft / 60).toString().padStart(2, '0');
          const secs = (g.secondsLeft % 60).toString().padStart(2, '0');
          return (
            <div
              key={`flag-group-${g.key}`}
              className="order-strike-flag"
              data-testid={`order-flag-group-${g.key}`}
              style={{
                position: 'absolute',
                top: `${flagYs[k]}px`,
                right: '76px',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--bg-2)',
                border: `1px solid ${stateColor(g)}`,
                color: 'var(--text-strong)',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                transition: 'top var(--t-base) var(--ease)',
              }}
            >
              <span aria-hidden="true" style={{ color: g.direction === 'UP' ? 'var(--profit)' : 'var(--loss)' }}>
                {g.direction === 'UP' ? '▲' : '▼'}
              </span>
              <span>{formatGroupStake(g)}</span>
              <span style={{ color: 'var(--text-muted)' }}>@{g.strikeFormatted}</span>
              <span style={{ color: 'var(--text-muted)' }}>{`${mins}:${secs}`}</span>
            </div>
          );
        })}

        {hiddenCount > 0 && (
          <div
            data-testid="order-flags-more"
            title="Ver todas en Portafolio"
            style={{
              position: 'absolute',
              top: `${Math.min(containerHeight - 24, (flagYs.length ? Math.max(...flagYs) : 24) + 24)}px`,
              right: '76px',
              transform: 'translateY(-50%)',
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
          >
            {`+${hiddenCount}`}
          </div>
        )}
      </>
    );
  }

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
      {!polish && openContracts.length > 0 && (
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
      {!polish && openContracts.map((contract, index) => {
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

      {polishLayer}

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
