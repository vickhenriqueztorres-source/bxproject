import type { UTCTimestamp } from 'lightweight-charts';

export type DrawingToolType = 
  | 'line'
  | 'trend_line'
  | 'horizontal_line'
  | 'vertical_line'
  | 'fibonacci'
  | null;

export interface Point2D {
  time: UTCTimestamp;
  price: number;
  logical?: number;
}

export interface DrawingItem {
  id: string;
  type: 'line' | 'trend_line' | 'horizontal_line' | 'vertical_line' | 'fibonacci';
  p1: Point2D;
  p2?: Point2D;
  color: string;
  lineWidth: number;
  label?: string;
}

export type IndicatorType = 
  | 'SMA' 
  | 'EMA' 
  | 'WMA' 
  | 'BOLLINGER' 
  | 'RSI' 
  | 'MACD' 
  | 'STOCHASTIC' 
  | 'ATR' 
  | 'VWAP' 
  | 'CCI';

export type IndicatorCategory = 'MA' | 'Oscillator' | 'Volatility' | 'Volume';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  period: number;
  color: string;
  enabled: boolean;
  category?: IndicatorCategory;
  description?: string;
  // Parâmetros secundários
  stdDev?: number;          // Bollinger Bands
  fastPeriod?: number;      // MACD
  slowPeriod?: number;      // MACD
  signalPeriod?: number;    // MACD
  kPeriod?: number;         // Stochastic
  dPeriod?: number;         // Stochastic
  signalColor?: string;     // Linha de sinal secundária (MACD, Stochastic)
}

export const FIBONACCI_LEVELS = [
  { level: 0, label: '0.0%', color: '#8295b3' },
  { level: 0.236, label: '23.6%', color: '#60a5fa' },
  { level: 0.382, label: '38.2%', color: '#34d399' },
  { level: 0.5, label: '50.0%', color: '#fbbf24' },
  { level: 0.618, label: '61.8%', color: '#f87171' },
  { level: 1.0, label: '100.0%', color: '#a78bfa' },
];

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  // Médias Móveis
  { id: 'sma_9', type: 'SMA', period: 9, color: '#fbbf24', enabled: false, category: 'MA', description: 'Média Móvel Simples de 9 períodos' },
  { id: 'sma_21', type: 'SMA', period: 21, color: '#38bdf8', enabled: false, category: 'MA', description: 'Média Móvel Simples de 21 períodos' },
  { id: 'ema_14', type: 'EMA', period: 14, color: '#ec4899', enabled: false, category: 'MA', description: 'Média Móvel Exponencial de 14 períodos' },
  { id: 'wma_20', type: 'WMA', period: 20, color: '#84cc16', enabled: false, category: 'MA', description: 'Média Móvel Ponderada (baixo lag)' },

  // Volatilidade
  { id: 'bollinger_20', type: 'BOLLINGER', period: 20, color: '#a855f7', enabled: false, stdDev: 2, category: 'Volatility', description: 'Bandas de Bollinger (20, 2σ)' },
  { id: 'atr_14', type: 'ATR', period: 14, color: '#f43f5e', enabled: false, category: 'Volatility', description: 'Average True Range (14)' },

  // Osciladores
  { id: 'rsi_14', type: 'RSI', period: 14, color: '#10b981', enabled: false, category: 'Oscillator', description: 'Relative Strength Index de Wilder' },
  { id: 'macd_12_26_9', type: 'MACD', period: 12, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#06b6d4', signalColor: '#f97316', enabled: false, category: 'Oscillator', description: 'MACD (12, 26, 9)' },
  { id: 'stoch_14_3', type: 'STOCHASTIC', period: 14, kPeriod: 14, dPeriod: 3, color: '#6366f1', signalColor: '#eab308', enabled: false, category: 'Oscillator', description: 'Oscilador Estocástico (%K 14, %D 3)' },
  { id: 'cci_20', type: 'CCI', period: 20, color: '#14b8a6', enabled: false, category: 'Oscillator', description: 'Commodity Channel Index (20)' },

  // Volume
  { id: 'vwap', type: 'VWAP', period: 0, color: '#eab308', enabled: false, category: 'Volume', description: 'Volume Weighted Average Price' },
];
