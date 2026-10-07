import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getContract, openContract, type Receipt } from '../api/client';
import { formatMinor, parseStakeInput } from '../lib/money';
import { soundEngine } from '../lib/sound-engine';
import { getAssetMeta } from '../catalog/assets';

const messages: Record<string, string> = {
  INDEX_PAUSED: 'Índice pausado pela operação.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente.',
  WALLET_PROVISIONING: 'A carteira está sendo preparada. Tente novamente em instantes.',
  RATE_LIMITED: 'Muitas ordens em sequência. Aguarde alguns segundos.',
  TICK_UNAVAILABLE: 'Cotação indisponível no momento.',
  AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente.',
  FEED_STALE: 'Feed de cotações desatualizado. Ordem bloqueada por segurança.',
  KILLSWITCH_ACTIVE: 'Kill switch de risco ativo. Operação suspensa temporariamente para este ativo.',
};

export interface OrderTicketProps {
  symbol: string;
  paused: boolean;
  stale: boolean;
  availableMinor: number | null;
  soundEnabled?: boolean;
  onChanged: () => void;
}

export function OrderTicket({
  symbol,
  paused,
  stale,
  availableMinor,
  soundEnabled = true,
  onChanged,
}: OrderTicketProps) {
  const [stake, setStake] = useState('10,00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [now, setNow] = useState(Date.now());
  const intent = useRef<{ key: string; direction: 'UP' | 'DOWN'; stakeMinor: number } | null>(null);
  const notified = useRef<string | null>(null);

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
    }
  }, [contract.data, onChanged]);

  const stakeMinor = parseStakeInput(stake);

  // Contagem regressiva da vela atual (ciclo de 60 segundos)
  const secondsInMinute = Math.floor(now / 1000) % 60;
  const candleRemaining = 60 - secondsInMinute;
  const isLocked30s = candleRemaining <= 30;

  const remainingReceipt = receipt
    ? Math.max(0, Math.ceil((Date.parse(receipt.expires_at) - now) / 1000))
    : 0;

  const blocked =
    paused ||
    stale ||
    availableMinor === null ||
    stakeMinor === null ||
    stakeMinor > availableMinor ||
    isLocked30s;

  const assetMeta = getAssetMeta(symbol);
  const payoutPct = assetMeta.payout;
  const payoutProfitMinor = stakeMinor !== null ? Math.round(stakeMinor * (payoutPct / 100)) : 850;
  const totalReturnMinor = (stakeMinor ?? 1000) + payoutProfitMinor;

  const adjustStake = (delta: number) => {
    soundEngine.playClick();
    const current = stakeMinor !== null ? stakeMinor : 1000;
    const next = Math.max(100, Math.min(10000, current + delta));
    setStake((next / 100).toFixed(2).replace('.', ','));
  };

  const setPreset = (valueUsd: number) => {
    soundEngine.playClick();
    setStake(valueUsd.toFixed(2).replace('.', ','));
  };

  async function handleExecute(direction: 'UP' | 'DOWN') {
    if (blocked || busy || stakeMinor === null) return;
    const current = { key: crypto.randomUUID(), direction, stakeMinor };
    intent.current = current;
    setBusy(true);
    setError('');
    soundEngine.playOrderOpen();

    try {
      const opened = await openContract(symbol, current.direction, current.stakeMinor, current.key);
      setReceipt(opened);
      intent.current = null;
      onChanged();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(messages[cause.code] ?? 'Não foi possível enviar a ordem.');
        if (cause.status < 500 && cause.status !== 429) intent.current = null;
        if (cause.code === 'INDEX_PAUSED') onChanged();
      } else {
        setError('Sem conexão. Tente novamente com a mesma ordem.');
      }
    } finally {
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
      {/* Card 1: Tempo de Expiração da Vela */}
      <div
        style={{
          background: '#101a2f',
          border: '1px solid #1f2e4b',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#8898b8', fontWeight: 600 }}>TEMPO DE EXPIRAÇÃO</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: isLocked30s ? '#ffab00' : '#00e676',
            }}
          >
            {isLocked30s ? '🔒 TRAVADO (:30s)' : 'ABERTO'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: '20px', fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>
            00:{candleRemaining < 10 ? `0${candleRemaining}` : candleRemaining}
          </strong>
          <small style={{ fontSize: '11px', color: '#687b99' }}>Vela de 1 Minuto</small>
        </div>
      </div>

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
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            {contract.data?.status === 'SETTLED' ? (
              contract.data.result === 'WIN' ? (
                <span style={{ color: '#00e676' }}>🎉 Vitória! Ganhou {formatMinor(contract.data.payout_minor ?? 0)}</span>
              ) : contract.data.result === 'DRAW' ? (
                <span style={{ color: '#ffab00' }}>🤝 Empate! Estorno {formatMinor(contract.data.payout_minor ?? 0)}</span>
              ) : (
                <span style={{ color: '#ff3d71' }}>✕ Não atingiu o alvo</span>
              )
            ) : remainingReceipt > 0 ? (
              <span style={{ color: '#65d5ff' }}>⏳ Expira em {remainingReceipt} segundos…</span>
            ) : (
              <span style={{ color: '#ffab00' }}>Processando liquidação oficial…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
