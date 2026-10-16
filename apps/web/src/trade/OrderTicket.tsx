import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getContract, openContract, type Receipt, type Contract } from '../api/client';
import { formatMinor, formatCurrencyBinmax, parseStakeInput } from '../lib/money';
export { formatCurrencyBinmax } from '../lib/money';
import { soundEngine } from '../lib/sound-engine';
import { getAssetMeta, normalizeSymbol } from '../catalog/assets';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import { safeRandomUUID } from '../lib/uuid';
import { ExpiryDropdown } from './ExpiryDropdown';
import { calculateExecutionExpiry, calculateExpirySlots, formatSecondsToMmSs, type ExpirySlot, type ExpiryMode } from './expiry-calculator';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { isTraderoomPolishEnabled } from '../lib/traderoom-polish';
import { useUiLanguage } from '../i18n';

const messages: Record<string, string> = {
  INDEX_PAUSED: 'Índice pausado pela operação.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente.',
  WALLET_PROVISIONING: 'A carteira está sendo preparada. Tente novamente em instantes.',
  RATE_LIMITED: 'Muitas ordens em sequência. Aguarde alguns segundos.',
  TICK_UNAVAILABLE: 'Cotação indisponível no momento.',
  AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  FEED_STALE: 'Feed de cotações desatualizado. Ordem bloqueada por segurança.',
  KILLSWITCH_ACTIVE: 'Kill switch de risco ativo. Operação suspensa temporariamente para este ativo.',
  LEDGER_UNAVAILABLE: 'Serviço contábil temporariamente indisponível. Tente novamente em instantes.',
  MARKET_NOT_READY: 'O motor de mercado está sincronizando. Aguarde alguns segundos.',
  MARKET_STORE_UNAVAILABLE: 'Serviço de cotações indisponível no momento. Tente novamente.',
  DB_TRANSACTION_FAILED: 'Falha temporária ao registrar a ordem. Tente novamente.',
  STAKE_OUT_OF_BOUNDS: 'Valor da ordem fora dos limites permitidos.',
  INVALID_STAKE: 'Valor mínimo de operação é de $1,00.',
  INVALID_SYMBOL: 'Ativo indisponível para operação no momento.',
  RISK_LIMIT_EXCEEDED: 'Limite de exposição atingido para este ativo. Aguarde a liquidação.',
};

export interface OrderTicketProps {
  symbol: string;
  paused: boolean;
  stale: boolean;
  availableMinor: number | null;
  soundEnabled?: boolean;
  onChanged: () => void;
  isCompact?: boolean;
}

export function OrderTicket({
  symbol,
  paused,
  stale,
  availableMinor,
  soundEnabled = true,
  onChanged,
  isCompact = false,
}: OrderTicketProps) {
  const isBinmax = isNewTraderoomEnabled();
  // Acabamento profissional (TRADEROOM_POLISH). Desligada = ticket idêntico ao anterior.
  const polish = isBinmax && isTraderoomPolishEnabled();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';
  const queryClient = useQueryClient();
  const [stake, setStake] = useState(isBinmax ? '100' : '10,00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selectedSlotId, setSelectedSlotId] = useState<string>('candle_1m');
  const [selectedSlot, setSelectedSlot] = useState<ExpirySlot | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const intent = useRef<{ key: string; direction: 'UP' | 'DOWN'; stakeMinor: number } | null>(null);
  const notified = useRef<string | null>(null);
  const executingRef = useRef(false);
  const slots = calculateExpirySlots(new Date(), -3);
  const activeSlot = slots.find((s) => s.id === selectedSlotId) ?? slots[0];

  const navigateSlot = (direction: 1 | -1) => {
    soundEngine.playClick();
    const currentIndex = slots.findIndex((s) => s.id === selectedSlotId);
    const nextIndex = Math.max(0, Math.min(slots.length - 1, currentIndex + direction));
    const target = slots[nextIndex];
    if (target) {
      setSelectedSlotId(target.id);
      setSelectedSlot(target);
    }
  };

  const contract = useQuery({
    queryKey: ['contract', receipt?.id],
    queryFn: () => getContract(receipt!.id),
    enabled: Boolean(receipt?.id),
    refetchInterval: (query) =>
      ['SETTLED', 'FAILED_COMPENSATION', 'CANCELLED'].includes(query.state.data?.status ?? '')
        ? false
        : 1000,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    soundEngine.setMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const value = contract.data;
    if (value && ['SETTLED', 'FAILED_COMPENSATION', 'CANCELLED'].includes(value.status) && notified.current !== value.id) {
      notified.current = value.id;
      if (value.result === 'WIN') soundEngine.playWin();
      else if (value.result === 'LOSS') soundEngine.playLoss();
      else if (value.result === 'DRAW') soundEngine.playDraw();
      onChanged();

      // Auto-reset ágil: mostra resultado por 800ms, depois libera para nova operação sem travar o usuário
      const timer = setTimeout(() => {
        setReceipt(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [contract.data, onChanged]);

  const stakeMinor = parseStakeInput(stake);

  // Contagem regressiva da vela atual (ciclo de 60 segundos)
  const secondsInMinute = Math.floor(now / 1000) % 60;
  const candleRemaining = 60 - secondsInMinute;
  const isLocked30s = false;

  const remainingReceipt = receipt
    ? Math.max(0, Math.ceil((Date.parse(receipt.expires_at) - now) / 1000))
    : 0;

  const currentAvailable = availableMinor ?? 1000000;
  const blocked =
    paused ||
    stale ||
    stakeMinor === null ||
    stakeMinor > currentAvailable;

  const assetMeta = getAssetMeta(symbol);
  const payoutPct = assetMeta.payout;
  const payoutProfitMinor = stakeMinor !== null ? Math.round(stakeMinor * (payoutPct / 100)) : 850;
  const totalReturnMinor = (stakeMinor ?? 1000) + payoutProfitMinor;

  const adjustStake = (delta: number) => {
    soundEngine.playClick();
    const current = stakeMinor !== null ? stakeMinor : 1000;
    const next = Math.max(100, Math.min(10000, current + delta));
    if (next % 100 === 0) {
      setStake(String(next / 100));
    } else {
      setStake((next / 100).toFixed(2).replace('.', ','));
    }
  };

  const setPreset = (valueUsd: number) => {
    soundEngine.playClick();
    setStake(valueUsd.toFixed(2).replace('.', ','));
  };

  async function handleExecute(direction: 'UP' | 'DOWN') {
    if (executingRef.current || blocked || busy || stakeMinor === null) return;
    executingRef.current = true;
    setBusy(true);
    setError('');

    const key = safeRandomUUID();
    const current = { key, direction, stakeMinor };
    intent.current = current;

    // Resolução de modo corrigida: honra o slot ativo (CANDLE_1M) se selectedSlot for null (Subetapa 9.1)
    const mode: ExpiryMode = (selectedSlot ?? activeSlot).mode;
    const { durationMs, targetEpochMs } = calculateExecutionExpiry(mode, Date.now());
    const durationSeconds = Math.max(60, Math.min(300, Math.round(durationMs / 1000)));
    const targetExpiresAt = new Date(targetEpochMs).toISOString();

    // Captura da cotação instantânea no milissegundo exato do clique (< 16ms)
    const norm = normalizeSymbol(symbol);
    const lastStr = tradingFeedManager.getLastPrice(norm) ?? tradingFeedManager.getLastPrice(symbol);
    const instantPrice = lastStr ? parseFloat(lastStr) : undefined;

    // Feedback sonoro e injeção otimista IMEDIATA no cache (< 16ms)
    soundEngine.playOrderOpen();

    const optimisticContract: Contract = {
      id: key,
      symbol,
      direction: current.direction,
      stake_minor: current.stakeMinor,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: targetExpiresAt,
      created_at: new Date().toISOString(),
      entry_price: instantPrice,
      strike_price: instantPrice,
    };

    // 1. Injeta imediatamente o contrato para desenhar a linha de strike no gráfico (< 16ms)
    queryClient.setQueryData<Contract[]>(['contracts'], (old = []) => [optimisticContract, ...old]);

    // 2. Reserva otimista imediata no saldo da carteira para atualizar o header
    queryClient.setQueryData<{ available_minor: number; reserved_minor?: number }>(['wallet'], (old) => {
      if (!old) return old;
      return {
        ...old,
        available_minor: Math.max(0, old.available_minor - current.stakeMinor),
        reserved_minor: (old.reserved_minor ?? 0) + current.stakeMinor,
      };
    });

    try {
      const opened = await openContract(
        symbol,
        current.direction,
        current.stakeMinor,
        current.key,
        durationSeconds,
        targetExpiresAt,
        mode
      );

      setReceipt(opened);
      intent.current = null;

      // Reconciliação atômica: substitui o contrato provisório com os dados oficiais do servidor
      queryClient.setQueryData<Contract[]>(['contracts'], (old = []) => {
        const confirmedEntry = opened.entry_price ?? opened.strike_price;
        return old.map((c) => {
          if (c.id === key) {
            const finalEntry = confirmedEntry ?? c.entry_price ?? c.strike_price;
            return {
              ...c,
              id: opened.id,
              entry_price: finalEntry,
              strike_price: finalEntry,
              exit_price: null,
              entry_tick_sequence: opened.entry_tick_sequence ?? c.entry_tick_sequence ?? null,
              expires_at: opened.expires_at ?? c.expires_at,
            };
          }
          return c;
        });
      });

      onChanged();
    } catch (cause) {
      // Rollback otimista em caso de erro
      queryClient.setQueryData<Contract[]>(['contracts'], (old = []) => old.filter((c) => c.id !== key));
      queryClient.setQueryData<{ available_minor: number; reserved_minor?: number }>(['wallet'], (old) => {
        if (!old) return old;
        return {
          ...old,
          available_minor: old.available_minor + current.stakeMinor,
          reserved_minor: Math.max(0, (old.reserved_minor ?? current.stakeMinor) - current.stakeMinor),
        };
      });

      if (cause instanceof ApiError) {
        setError(messages[cause.code] ?? 'Não foi possível enviar a ordem.');
        if (cause.status < 500 && cause.status !== 429) intent.current = null;
        if (cause.code === 'INDEX_PAUSED') onChanged();
      } else {
        setError(cause instanceof Error ? cause.message : 'Falha ao processar ordem. Tente novamente.');
      }
    } finally {
      executingRef.current = false;
      setBusy(false);
    }
  }

  // Atalhos de teclado seguros com supressão sob feed stale ou bloqueio (Passo 5.5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (blocked || busy || stakeMinor === null) return;

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleExecute('UP');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleExecute('DOWN');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [blocked, busy, stakeMinor]);

  if (isBinmax) {
    const formattedExpiryDisplay = activeSlot
      ? formatSecondsToMmSs(activeSlot.remainingSeconds)
      : '01:00';

    const ticketGap = isCompact ? 'clamp(2px, 0.4vh, 4px)' : '8px';
    const fieldHeight = isCompact ? 'clamp(28px, 3.8vh, 32px)' : '42px';
    const stepperBtnWidth = isCompact ? '26px' : '36px';
    const btnHeight = isCompact ? 'clamp(32px, 4.6vh, 38px)' : '48px';

    return (
      <div
        className="order-dock-container binmax-order-dock"
        data-testid="binmax-order-ticket"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isCompact ? 'space-between' : 'flex-start',
          gap: ticketGap,
          width: '100%',
          height: isCompact ? '100%' : 'auto',
          maxHeight: '100%',
          color: 'var(--text-strong)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* D1: MONTO */}
        <div className="binmax-ticket-block" data-testid="ticket-block-monto">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isCompact ? '3px' : '6px',
            }}
          >
            <span style={{ fontSize: isCompact ? '11px' : '12px', color: polish ? 'var(--text-muted)' : '#8A92A1', fontWeight: 500, fontFamily: polish ? 'var(--font-ui)' : "'Inter', sans-serif" }}>
              {isPt ? 'Valor' : 'Monto'}
            </span>
            <span
              aria-label="Ayuda monto"
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '1px solid rgba(138, 146, 161, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ?
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: polish ? 'var(--bg-3)' : '#151922',
              border: polish ? '1px solid var(--line)' : '1px solid rgba(244, 245, 247, 0.08)',
              borderRadius: '8px',
              height: fieldHeight,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              aria-label="Disminuir monto"
              onClick={() => adjustStake(-100)}
              style={{
                width: stepperBtnWidth,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                borderRight: '1px solid rgba(244, 245, 247, 0.06)',
                color: 'var(--text-muted)',
                fontSize: isCompact ? '14px' : '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              −
            </button>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
                padding: '0 4px',
                gap: '3px',
              }}
            >
              <span style={{ color: 'var(--text-quiet)', fontSize: '13px', fontWeight: 600 }}>
                $
              </span>
              <input
                id="binmax-stake-input"
                aria-label="Monto de la inversión"
                inputMode="decimal"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                style={{
                  width: '50px',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-strong)',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: "'Geist Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'center',
                }}
              />
            </div>

            <button
              type="button"
              aria-label="Aumentar monto"
              onClick={() => adjustStake(100)}
              style={{
                width: stepperBtnWidth,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                borderLeft: '1px solid rgba(244, 245, 247, 0.06)',
                color: 'var(--text-muted)',
                fontSize: isCompact ? '14px' : '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              +
            </button>
          </div>

          {/* Preset Buttons Row (proibidos na spec §D com TRADEROOM_POLISH) */}
          {!polish && (
          <div
            data-testid="stake-presets"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: isCompact ? '3px' : '6px',
              marginTop: isCompact ? '3px' : '8px',
            }}
          >
            {[10, 50, 100, 500].map((preset) => {
              const presetMinor = preset * 100;
              const isActive = stakeMinor === presetMinor;
              return (
                <button
                  key={preset}
                  type="button"
                  data-testid={`preset-${preset}`}
                  onClick={() => {
                    soundEngine.playClick();
                    setStake(String(preset));
                  }}
                  style={{
                    height: isCompact ? '20px' : '30px',
                    borderRadius: '6px',
                    background: isActive ? 'var(--profit)' : '#1A1F2B',
                    border: isActive ? '1px solid var(--profit)' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: isCompact ? '10.5px' : '12px',
                    fontWeight: 700,
                    fontFamily: "'Geist Mono', monospace",
                    cursor: 'pointer',
                    transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                    padding: 0,
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* D2: EXPIRACIÓN */}
        <div className="binmax-ticket-block" data-testid="ticket-block-expiracion" style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isCompact ? '3px' : '6px',
            }}
          >
            <span style={{ fontSize: isCompact ? '11px' : '12px', color: polish ? 'var(--text-muted)' : '#8A92A1', fontWeight: 500, fontFamily: polish ? 'var(--font-ui)' : "'Inter', sans-serif" }}>
              {isPt ? 'Expiração' : 'Expiración'}
            </span>
            <span
              aria-label="Ayuda expiración"
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '1px solid rgba(138, 146, 161, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ?
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: polish ? 'var(--bg-3)' : '#151922',
              border: polish ? '1px solid var(--line)' : '1px solid rgba(244, 245, 247, 0.08)',
              borderRadius: '8px',
              height: fieldHeight,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              aria-label="Anterior expiración"
              onClick={() => navigateSlot(-1)}
              style={{
                width: stepperBtnWidth,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                borderRight: '1px solid rgba(244, 245, 247, 0.06)',
                color: 'var(--text-muted)',
                fontSize: isCompact ? '14px' : '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              −
            </button>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                gap: '6px',
                minWidth: 0,
              }}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-quiet)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span
                style={{
                  color: 'var(--text-strong)',
                  fontSize: isCompact ? '14px' : '16px',
                  fontWeight: 700,
                  fontFamily: "'Geist Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formattedExpiryDisplay}
              </span>
            </div>

            <button
              type="button"
              aria-label="Siguiente expiración"
              onClick={() => navigateSlot(1)}
              style={{
                width: stepperBtnWidth,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                borderLeft: '1px solid rgba(244, 245, 247, 0.06)',
                color: 'var(--text-muted)',
                fontSize: isCompact ? '14px' : '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: 1,
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              +
            </button>
          </div>

          {dropdownOpen && (
            <div
              data-testid="expiry-dropdown-menu"
              style={{
                position: 'absolute',
                top: '56px',
                right: 0,
                width: '180px',
                background: polish ? 'var(--bg-2)' : '#151922',
                border: '1px solid rgba(244, 245, 247, 0.15)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                zIndex: 100,
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSlotId(s.id);
                    setSelectedSlot(s);
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: s.id === selectedSlotId ? 'rgba(34, 196, 122, 0.15)' : 'transparent',
                    border: s.id === selectedSlotId ? '1px solid var(--profit)' : 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    color: s.id === selectedSlotId ? 'var(--profit)' : 'var(--text-strong)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left',
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>
                    {s.targetTimeFormatted}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* D3: GANANCIA */}
        <div
          className="binmax-ticket-block"
          data-testid="ticket-block-ganancia"
          style={{ textAlign: 'center', padding: isCompact ? '0' : '2px 0' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isCompact ? '1px' : '2px',
            }}
          >
            <span style={{ fontSize: isCompact ? '10px' : '12px', color: polish ? 'var(--text-muted)' : '#8A92A1', fontWeight: 500, fontFamily: polish ? 'var(--font-ui)' : "'Inter', sans-serif" }}>
              {isPt ? 'Lucro' : 'Ganancia'}
            </span>
            <span
              aria-label="Ayuda ganancia"
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                width: '13px',
                height: '13px',
                borderRadius: '50%',
                border: '1px solid rgba(138, 146, 161, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ?
            </span>
          </div>

          <div
            data-testid="ganancia-pct"
            style={{
              fontSize: polish ? (isCompact ? '28px' : '40px') : (isCompact ? '18px' : '22px'),
              fontWeight: polish ? 600 : 800,
              lineHeight: '1.05',
              color: polish ? 'var(--profit)' : '#22C55E',
              fontFamily: "'Geist Mono', monospace",
              letterSpacing: '-0.3px',
            }}
          >
            {polish ? (
              <>
                {`+${payoutPct}`}
                <span data-testid="ganancia-pct-sign" style={{ fontSize: isCompact ? '18px' : '24px', fontWeight: 500 }}>%</span>
              </>
            ) : `+${payoutPct}%`}
          </div>

          <div
            data-testid="ganancia-amount"
            style={{
              fontSize: polish ? (isCompact ? '14px' : '18px') : (isCompact ? '11.5px' : '13px'),
              fontWeight: 700,
              color: polish ? 'var(--profit)' : '#22C55E',
              fontFamily: "'Geist Mono', monospace",
              marginTop: isCompact ? '0' : '1px',
            }}
          >
            {isBinmax ? `+${formatCurrencyBinmax(payoutProfitMinor)}` : `+${formatMinor(payoutProfitMinor)}`}
          </div>
        </div>

        {/* D4: SUBE */}
        <button
          type="button"
          data-testid="btn-sube"
          aria-label="Operación Sube"
          disabled={blocked || busy}
          onClick={() => handleExecute('UP')}
          style={{
            width: '100%',
            height: polish && !isCompact ? '80px' : btnHeight,
            borderRadius: polish ? '10px' : '6px',
            background: polish ? 'var(--profit)' : '#22C55E',
            border: 'none',
            color: polish ? 'var(--bg-0)' : '#FFFFFF',
            cursor: blocked || busy ? 'not-allowed' : 'pointer',
            opacity: blocked || busy ? 0.45 : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isCompact ? '2px' : '3px',
            padding: '4px',
            boxSizing: 'border-box',
            boxShadow: polish || blocked || busy ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.25)',
            transition: polish
              ? 'transform var(--t-micro) var(--ease), opacity var(--t-micro) var(--ease), background-color var(--t-micro) var(--ease)'
              : 'transform 0.12s ease, opacity 0.12s ease, background 0.12s ease',
          }}
        >
          <svg
            width={isCompact ? '18' : '20'}
            height={isCompact ? '18' : '20'}
            viewBox="0 0 24 24"
            fill="none"
            stroke={polish ? 'currentColor' : '#FFFFFF'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-testid="icon-sube"
          >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span style={{ fontSize: polish ? (isCompact ? '13px' : '15px') : (isCompact ? '12px' : '13px'), fontWeight: polish ? 700 : 800, letterSpacing: '0.6px', color: polish ? 'currentColor' : '#FFFFFF' }}>
            {isPt ? 'ACIMA' : 'SUBE'}
          </span>
        </button>

        {/* D5: BAJA */}
        <button
          type="button"
          data-testid="btn-baja"
          aria-label="Operación Baja"
          disabled={blocked || busy}
          onClick={() => handleExecute('DOWN')}
          style={{
            width: '100%',
            height: polish && !isCompact ? '80px' : btnHeight,
            borderRadius: polish ? '10px' : '6px',
            background: polish ? 'var(--loss)' : '#E5484D',
            border: 'none',
            color: polish ? 'var(--bg-0)' : '#FFFFFF',
            cursor: blocked || busy ? 'not-allowed' : 'pointer',
            opacity: blocked || busy ? 0.45 : 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isCompact ? '2px' : '3px',
            padding: '4px',
            boxSizing: 'border-box',
            boxShadow: polish || blocked || busy ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.25)',
            transition: polish
              ? 'transform var(--t-micro) var(--ease), opacity var(--t-micro) var(--ease), background-color var(--t-micro) var(--ease)'
              : 'transform 0.12s ease, opacity 0.12s ease, background 0.12s ease',
          }}
        >
          <svg
            width={isCompact ? '18' : '20'}
            height={isCompact ? '18' : '20'}
            viewBox="0 0 24 24"
            fill="none"
            stroke={polish ? 'currentColor' : '#FFFFFF'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-testid="icon-baja"
          >
            <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
            <polyline points="16 17 22 17 22 11" />
          </svg>
          <span style={{ fontSize: polish ? (isCompact ? '13px' : '15px') : (isCompact ? '12px' : '13px'), fontWeight: polish ? 700 : 800, letterSpacing: '0.6px', color: polish ? 'currentColor' : '#FFFFFF' }}>
            {isPt ? 'ABAIXO' : 'BAJA'}
          </span>
        </button>

        {/* Mensagens de Alerta ou Trava Compactas */}
        {paused && (
          <div
            data-testid="badge-paused"
            style={{
              background: '#3b2222',
              border: '1px solid #783535',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '10px',
              color: 'var(--loss)',
              textAlign: 'center',
            }}
          >
            Pausado
          </div>
        )}
        {stale && !paused && (
          <div
            data-testid="badge-stale"
            style={{
              background: '#3b2f22',
              border: '1px solid #785a35',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '10px',
              color: 'var(--pending)',
              textAlign: 'center',
            }}
          >
            Atrasado
          </div>
        )}
        {error && (
          <div
            role="alert"
            data-testid="ticket-error"
            style={{
              background: '#3b2222',
              border: '1px solid #783535',
              borderRadius: '6px',
              padding: '6px',
              fontSize: '10px',
              color: 'var(--loss)',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* Confirmação do preço executado oficial e resumo discreto de última operação (Relatório #12) */}
        {receipt && contract.data?.status !== 'SETTLED' && (receipt.entry_price ?? receipt.strike_price) !== undefined && (
          <div
            data-testid="receipt-executed-price"
            style={{
              textAlign: 'center',
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontFamily: "'Geist Mono', monospace",
            }}
            aria-live="polite"
          >
            {isPt ? 'Executado a' : 'Ejecutado a'} {Number(receipt.entry_price ?? receipt.strike_price).toFixed(4)}
          </div>
        )}
        {receipt && contract.data?.status === 'SETTLED' && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '6px',
            }}
            aria-live="polite"
          >
            Última operación:{' '}
            <span
              style={{
                color: contract.data.result === 'WIN' ? 'var(--profit)' : contract.data.result === 'DRAW' ? 'var(--pending)' : 'var(--loss)',
                fontWeight: 700,
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {contract.data.result === 'WIN'
                ? `+${isBinmax ? formatCurrencyBinmax(contract.data.payout_minor ?? 0) : formatMinor(contract.data.payout_minor ?? 0)}`
                : contract.data.result === 'DRAW'
                ? (isBinmax ? formatCurrencyBinmax(contract.data.payout_minor ?? 0) : formatMinor(contract.data.payout_minor ?? 0))
                : `−${isBinmax ? formatCurrencyBinmax(stakeMinor ?? 1000) : formatMinor(stakeMinor ?? 1000)}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="order-dock-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        color: '#e8edf8',
        boxSizing: 'border-box',
      }}
    >
      {/* Card 0: Ativo Selecionado & Rendimento */}
      <div
        style={{
          background: '#101a2f',
          border: '1px solid #1f2e4b',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{symbol}</span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              {assetMeta.category}
            </span>
          </div>
          <small style={{ color: '#687b99', fontSize: '10px' }}>{assetMeta.name}</small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '9px', color: '#8898b8', display: 'block', fontWeight: 600 }}>
            LUCRO POTENCIAL
          </span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#00e676' }}>
            +{payoutPct}%
          </span>
        </div>
      </div>
      {/* Card 1: Seletor de Tempo de Expiração Estilo IQ Option */}
      <ExpiryDropdown
        selectedSlotId={selectedSlotId}
        onSelectSlot={(slot) => {
          setSelectedSlotId(slot.id);
          setSelectedSlot(slot);
        }}
      />

      {/* Card 2: Valor do Investimento (Stake) com Steppers & Presets */}
      <div
        style={{
          background: '#101a2f',
          border: '1px solid #1f2e4b',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <label htmlFor="stake-input" style={{ fontSize: '11px', color: '#8898b8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          VALOR DO INVESTIMENTO
        </label>

        {/* Stepper Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={() => adjustStake(-100)}
            style={{
              width: '36px',
              height: '38px',
              borderRadius: '8px',
              background: '#17253d',
              border: '1px solid #2b3d5e',
              color: '#dce8fb',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Diminuir US$ 1,00"
          >
            −
          </button>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: '#090f1d',
              border: '1px solid #253654',
              borderRadius: '8px',
              padding: '0 10px',
              height: '38px',
            }}
          >
            <span style={{ color: '#00e676', fontWeight: 700, fontSize: '14px', marginRight: '4px' }}>$</span>
            <input
              id="stake-input"
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            />
            <span style={{ fontSize: '10px', color: '#687b99', fontWeight: 600 }}>USD</span>
          </div>

          <button
            type="button"
            onClick={() => adjustStake(100)}
            style={{
              width: '36px',
              height: '38px',
              borderRadius: '8px',
              background: '#17253d',
              border: '1px solid #2b3d5e',
              color: '#dce8fb',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            title="Aumentar US$ 1,00"
          >
            +
          </button>
        </div>

        {/* Presets Rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {[1, 5, 10, 25].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setPreset(val)}
              style={{
                background: '#142036',
                border: '1px solid #203150',
                color: '#9cb0d0',
                padding: '4px 0',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      {/* Card 3: Lucro Esperado & Rendimento */}
      <div
        style={{
          background: 'rgba(0, 230, 118, 0.05)',
          border: '1px solid rgba(0, 230, 118, 0.25)',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#8898b8', fontWeight: 600 }}>RENDIMENTO</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#00e676' }}>+85%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
          <span style={{ fontSize: '11px', color: '#a2b3cf' }}>Lucro Líquido:</span>
          <strong style={{ fontSize: '16px', color: '#00e676', fontFamily: "'Space Grotesk', sans-serif" }}>
            +{formatMinor(payoutProfitMinor)}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: '#687b99' }}>Retorno total:</span>
          <span style={{ fontSize: '12px', color: '#d0dfeb', fontWeight: 600 }}>
            {formatMinor(totalReturnMinor)}
          </span>
        </div>
      </div>

      {/* Mensagens de Alerta ou Trava */}
      {isLocked30s && (
        <div
          style={{
            background: 'rgba(255, 171, 0, 0.1)',
            border: '1px solid rgba(255, 171, 0, 0.35)',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '11px',
            color: '#ffc107',
            textAlign: 'center',
          }}
        >
          ⏱️ Entradas travadas nos últimos 30s da vela. Aguarde a abertura da próxima.
        </div>
      )}
      {paused && (
        <div style={{ background: '#3b2222', border: '1px solid #783535', borderRadius: '8px', padding: '8px', fontSize: '11px', color: '#ff9da5', textAlign: 'center' }}>
          Índice pausado pela operação.
        </div>
      )}
      {stale && !paused && (
        <div style={{ background: '#3b2f22', border: '1px solid #785a35', borderRadius: '8px', padding: '8px', fontSize: '11px', color: '#ffc107', textAlign: 'center' }}>
          Feed atrasado. Aguarde cotação atualizada.
        </div>
      )}
      {error && (
        <div role="alert" style={{ background: '#3b2222', border: '1px solid #783535', borderRadius: '8px', padding: '8px', fontSize: '11px', color: '#ff9da5', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Botões Operacionais de Alta Ação: ACIMA (CALL) e ABAIXO (PUT) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
        {/* Botão ACIMA (CALL - Verde) */}
        <button
          type="button"
          disabled={blocked || busy}
          onClick={() => handleExecute('UP')}
          style={{
            height: '60px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00e676 0%, #00c853 100%)',
            border: 'none',
            color: '#051827',
            cursor: blocked || busy ? 'not-allowed' : 'pointer',
            opacity: blocked || busy ? 0.45 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            boxShadow: blocked || busy ? 'none' : '0 4px 20px rgba(0, 230, 118, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900 }}>▲</span>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '16px', display: 'block', letterSpacing: '0.5px' }}>ACIMA</strong>
              <small style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>COMPRA / CALL</small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '15px', fontFamily: "'Space Grotesk', sans-serif" }}>
              +{formatMinor(payoutProfitMinor)}
            </strong>
          </div>
        </button>

        {/* Botão ABAIXO (PUT - Vermelho) */}
        <button
          type="button"
          disabled={blocked || busy}
          onClick={() => handleExecute('DOWN')}
          style={{
            height: '60px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ff3d71 0%, #d81b60 100%)',
            border: 'none',
            color: '#ffffff',
            cursor: blocked || busy ? 'not-allowed' : 'pointer',
            opacity: blocked || busy ? 0.45 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            boxShadow: blocked || busy ? 'none' : '0 4px 20px rgba(255, 61, 113, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px', fontWeight: 900 }}>▼</span>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '16px', display: 'block', letterSpacing: '0.5px' }}>ABAIXO</strong>
              <small style={{ fontSize: '10px', opacity: 0.85, fontWeight: 700 }}>VENDA / PUT</small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '15px', fontFamily: "'Space Grotesk', sans-serif" }}>
              +{formatMinor(payoutProfitMinor)}
            </strong>
          </div>
        </button>
      </div>

      {/* Card de Contrato Recente / Em Andamento */}
      {receipt && (
        <div
          style={{
            background: '#121b2d',
            border: '1px solid #233454',
            borderRadius: '10px',
            padding: '12px',
            marginTop: '6px',
          }}
          aria-live="polite"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#687b99', fontWeight: 700 }}>OPERAÇÃO EM VOO</span>
            <small style={{ color: '#8898b8', fontSize: '10px' }}>#{receipt.id.slice(0, 8)}</small>
          </div>
          {(receipt.entry_price ?? receipt.strike_price) !== undefined && (
            <div data-testid="receipt-executed-price" style={{ fontSize: '11px', color: '#a2b3cf', marginBottom: '4px' }}>
              Executado a {Number(receipt.entry_price ?? receipt.strike_price).toFixed(4)}
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            {contract.data?.status === 'SETTLED' ? (
              contract.data.result === 'WIN' ? (
                <span style={{ color: '#00e676' }}>🎉 Vitória! Ganhou {formatMinor(contract.data.payout_minor ?? 0)}</span>
              ) : contract.data.result === 'DRAW' ? (
                <span style={{ color: 'var(--pending)' }}>🤝 Empate! Estorno {formatMinor(contract.data.payout_minor ?? 0)}</span>
              ) : (
                <span style={{ color: '#ff3d71' }}>✕ Não atingiu o alvo</span>
              )
            ) : remainingReceipt > 0 ? (
              <span style={{ color: '#65d5ff' }}>⏳ Expira em {remainingReceipt} segundos…</span>
            ) : (
              <span style={{ color: 'var(--pending)' }}>Processando liquidação oficial…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
