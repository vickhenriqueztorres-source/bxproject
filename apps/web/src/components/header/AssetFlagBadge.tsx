import React from 'react';

export interface AssetFlagBadgeProps {
  symbol: string;
  size?: number;
}

// SVGs vetoriais puros de alta definição e performance (sem dependência externa de CDN)
export const FlagCircle: React.FC<{ code: string; size?: number }> = ({ code, size = 16 }) => {
  const c = code.toUpperCase();

  // Japão (JPY)
  if (c === 'JPY' || c === 'JP') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#FFFFFF" />
        <circle cx="16" cy="16" r="8" fill="#BC002D" />
      </svg>
    );
  }

  // Estados Unidos (USD)
  if (c === 'USD' || c === 'US') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#B22234" />
        <path d="M0 4h32M0 9h32M0 14h32M0 19h32M0 24h32M0 29h32" stroke="#FFFFFF" strokeWidth="2.5" />
        <rect width="15" height="15" fill="#3C3B6E" />
        <circle cx="5" cy="5" r="1.2" fill="#FFFFFF" />
        <circle cx="10" cy="5" r="1.2" fill="#FFFFFF" />
        <circle cx="7.5" cy="9.5" r="1.2" fill="#FFFFFF" />
        <circle cx="5" cy="12" r="1.2" fill="#FFFFFF" />
        <circle cx="10" cy="12" r="1.2" fill="#FFFFFF" />
      </svg>
    );
  }

  // União Europeia (EUR)
  if (c === 'EUR' || c === 'EU') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#003399" />
        <circle cx="16" cy="8" r="1.2" fill="#FFCC00" />
        <circle cx="16" cy="24" r="1.2" fill="#FFCC00" />
        <circle cx="8" cy="16" r="1.2" fill="#FFCC00" />
        <circle cx="24" cy="16" r="1.2" fill="#FFCC00" />
        <circle cx="10.3" cy="10.3" r="1.2" fill="#FFCC00" />
        <circle cx="21.7" cy="10.3" r="1.2" fill="#FFCC00" />
        <circle cx="10.3" cy="21.7" r="1.2" fill="#FFCC00" />
        <circle cx="21.7" cy="21.7" r="1.2" fill="#FFCC00" />
      </svg>
    );
  }

  // Reino Unido (GBP)
  if (c === 'GBP' || c === 'GB' || c === 'UK') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#012169" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#FFFFFF" strokeWidth="4.5" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#C8102E" strokeWidth="2.5" />
        <path d="M16 0 v32 M0 16 h32" stroke="#FFFFFF" strokeWidth="7" />
        <path d="M16 0 v32 M0 16 h32" stroke="#C8102E" strokeWidth="4.5" />
      </svg>
    );
  }

  // Nova Zelândia (NZD)
  if (c === 'NZD' || c === 'NZ') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#00247D" />
        {/* Canton simplificado */}
        <rect width="14" height="14" fill="#012169" />
        <path d="M0 0 L14 14 M14 0 L0 14" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M0 0 L14 14 M14 0 L0 14" stroke="#C8102E" strokeWidth="1" />
        <path d="M7 0 v14 M0 7 h14" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M7 0 v14 M0 7 h14" stroke="#C8102E" strokeWidth="1.8" />
        {/* Southern Cross stars */}
        <circle cx="23" cy="8" r="1.5" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.5" />
        <circle cx="27" cy="14" r="1.5" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.5" />
        <circle cx="23" cy="22" r="1.5" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.5" />
        <circle cx="19" cy="16" r="1.3" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.5" />
      </svg>
    );
  }

  // Canadá (CAD)
  if (c === 'CAD' || c === 'CA') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#FF0000" />
        <rect x="8" width="16" height="32" fill="#FFFFFF" />
        {/* Folha de bordo estilizada */}
        <path d="M16 8 L18 13 L22 13 L19 16 L20 20 L16 18 L12 20 L13 16 L10 13 L14 13 Z" fill="#FF0000" />
        <rect x="15.2" y="19" width="1.6" height="5" fill="#FF0000" />
      </svg>
    );
  }

  // Austrália (AUD)
  if (c === 'AUD' || c === 'AU') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#00008B" />
        <rect width="14" height="14" fill="#012169" />
        <path d="M0 0 L14 14 M14 0 L0 14" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M0 0 L14 14 M14 0 L0 14" stroke="#C8102E" strokeWidth="1" />
        <path d="M7 0 v14 M0 7 h14" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M7 0 v14 M0 7 h14" stroke="#C8102E" strokeWidth="1.8" />
        {/* Estrelas brancas */}
        <circle cx="8" cy="23" r="2.5" fill="#FFFFFF" />
        <circle cx="23" cy="8" r="1.3" fill="#FFFFFF" />
        <circle cx="25" cy="14" r="1.3" fill="#FFFFFF" />
        <circle cx="23" cy="22" r="1.5" fill="#FFFFFF" />
        <circle cx="19" cy="16" r="1.2" fill="#FFFFFF" />
      </svg>
    );
  }

  // Suíça (CHF)
  if (c === 'CHF' || c === 'CH') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <rect width="32" height="32" fill="#D52B1E" />
        <rect x="13" y="7" width="6" height="18" fill="#FFFFFF" rx="1" />
        <rect x="7" y="13" width="18" height="6" fill="#FFFFFF" rx="1" />
      </svg>
    );
  }

  // Bitcoin (BTC)
  if (c === 'BTC') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <text x="16" y="22" fill="#FFFFFF" fontSize="18" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">₿</text>
      </svg>
    );
  }

  // Ethereum (ETH)
  if (c === 'ETH') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <path d="M16 5 L22 15 L16 19 L10 15 Z" fill="#FFFFFF" fillOpacity="0.8" />
        <path d="M16 20 L22 16 L16 27 L10 16 Z" fill="#FFFFFF" fillOpacity="0.9" />
      </svg>
    );
  }

  // Tether (USDT)
  if (c === 'USDT') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#26A17B" />
        <text x="16" y="22" fill="#FFFFFF" fontSize="18" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">₮</text>
      </svg>
    );
  }

  // Ouro (XAU / GOLD)
  if (c === 'XAU' || c === 'GOLD') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#E5A93C" />
        <circle cx="16" cy="16" r="12" fill="#F4C430" />
        <text x="16" y="21" fill="#4B3600" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">Au</text>
      </svg>
    );
  }

  // Prata (XAG)
  if (c === 'XAG') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#A8B2C1" />
        <circle cx="16" cy="16" r="12" fill="#DCE1EA" />
        <text x="16" y="21" fill="#2D3748" fontSize="12" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">Ag</text>
      </svg>
    );
  }

  // Petróleo (USOIL / UKOIL)
  if (c === 'USOIL' || c === 'UKOIL' || c === 'OIL') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#2B303A" />
        <path d="M16 7 C14 12 10 16 10 20 C10 23.3 12.7 26 16 26 C19.3 26 22 23.3 22 20 C22 16 18 12 16 7 Z" fill="#F2545B" />
      </svg>
    );
  }

  // Índices Sintéticos (SYNTH)
  if (c.startsWith('SYNTH') || c === 'VOL') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#151922" stroke="#22C47A" strokeWidth="2" />
        <path d="M6 16 Q11 8, 16 16 T26 16" fill="none" stroke="#22C47A" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // Fallback Genérico
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#1C273E" stroke="#8A92A1" strokeWidth="1.5" />
      <text x="16" y="20" fill="#DCE1EA" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
        {c.slice(0, 2)}
      </text>
    </svg>
  );
};

export const AssetFlagBadge: React.FC<AssetFlagBadgeProps> = ({ symbol, size = 18 }) => {
  const cleanSym = symbol.replace('_OTC', '').toUpperCase();

  // Caso 1: Sintéticos ou Commodities individuais
  if (cleanSym.startsWith('SYNTH') || cleanSym.startsWith('VOL') || cleanSym.startsWith('CRASH') || cleanSym === 'XAUUSD' || cleanSym === 'XAGUSD' || cleanSym === 'USOIL' || cleanSym === 'UKOIL') {
    if (cleanSym.startsWith('SYNTH') || cleanSym.startsWith('VOL') || cleanSym.startsWith('CRASH')) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <FlagCircle code="SYNTH" size={size} />
        </div>
      );
    }
    if (cleanSym === 'XAUUSD') {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <div style={{ zIndex: 2 }}><FlagCircle code="XAU" size={size} /></div>
          <div style={{ marginLeft: `-${Math.round(size * 0.35)}px`, zIndex: 1 }}><FlagCircle code="USD" size={size} /></div>
        </div>
      );
    }
    if (cleanSym === 'XAGUSD') {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <div style={{ zIndex: 2 }}><FlagCircle code="XAG" size={size} /></div>
          <div style={{ marginLeft: `-${Math.round(size * 0.35)}px`, zIndex: 1 }}><FlagCircle code="USD" size={size} /></div>
        </div>
      );
    }
    if (cleanSym === 'USOIL' || cleanSym === 'UKOIL') {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <FlagCircle code="OIL" size={size} />
        </div>
      );
    }
  }

  // Caso 2: Cripto (BTCUSD, ETHUSD, SOLUSD, etc.)
  if (cleanSym.startsWith('BTC') || cleanSym.startsWith('ETH') || cleanSym.startsWith('SOL') || cleanSym.startsWith('XRP') || cleanSym.startsWith('BNB') || cleanSym.startsWith('DOGE') || cleanSym.startsWith('AVAX') || cleanSym.startsWith('ADA')) {
    const cryptoCode = cleanSym.slice(0, 3);
    const quoteCode = cleanSym.slice(3) || 'USD';
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <div style={{ zIndex: 2 }}><FlagCircle code={cryptoCode} size={size} /></div>
        <div style={{ marginLeft: `-${Math.round(size * 0.35)}px`, zIndex: 1 }}><FlagCircle code={quoteCode} size={size} /></div>
      </div>
    );
  }

  // Caso 3: Pares Forex tradicionais (6 caracteres, ex: NZDJPY, EURUSD, GBPJPY, EURCAD, USDCAD)
  if (cleanSym.length >= 6) {
    const base = cleanSym.slice(0, 3);
    const quote = cleanSym.slice(3, 6);
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }} title={`${base} / ${quote}`}>
        <div style={{ zIndex: 2 }}><FlagCircle code={base} size={size} /></div>
        <div style={{ marginLeft: `-${Math.round(size * 0.35)}px`, zIndex: 1 }}><FlagCircle code={quote} size={size} /></div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <FlagCircle code={cleanSym} size={size} />
    </div>
  );
};
