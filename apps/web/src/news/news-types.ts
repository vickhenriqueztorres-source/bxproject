export type NewsCategory = 'ALL' | 'FOREX' | 'CRYPTO' | 'INDICES' | 'GLOBAL';
export type NewsSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface MarketNewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: NewsCategory;
  sentiment: NewsSentiment;
  published_at: string;
  image_url?: string;
}

export const FALLBACK_MARKET_NEWS: MarketNewsArticle[] = [
  {
    id: 'news_1',
    title: 'Mercado de Câmbio Sintético registra volume recorde com alta volatilidade',
    summary: 'Traders intensificam operações em contratos sintéticos OTC de curto prazo enquanto pares tradicionais operam em consolidação.',
    source: 'Broker Finance News',
    url: 'https://finance.yahoo.com',
    category: 'INDICES',
    sentiment: 'BULLISH',
    published_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'news_2',
    title: 'Bitcoin e Criptoativos testam suporte estratégico de consolidação global',
    summary: 'Fluxo institucional mantém demanda firme em derivativos de Bitcoin e Ethereum, sinalizando suporte técnico resiliente.',
    source: 'CryptoGlobe',
    url: 'https://coindesk.com',
    category: 'CRYPTO',
    sentiment: 'BULLISH',
    published_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'news_3',
    title: 'Decisão de juros do Banco Central americano impacta liquidez no Forex',
    summary: 'Declarações do Federal Reserve sobre inflação sustentada provocam oscilações nas taxas de swap e volatilidade de curto prazo.',
    source: 'Reuters Macro',
    url: 'https://reuters.com',
    category: 'FOREX',
    sentiment: 'NEUTRAL',
    published_at: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
  {
    id: 'news_4',
    title: 'Preço do Petróleo e Commodities recua após aumento de estoques globais',
    summary: 'Contratos futuros de energia registram queda de 1,8% no pregão europeu com desaceleração temporária do consumo industrial.',
    source: 'Bloomberg Markets',
    url: 'https://bloomberg.com',
    category: 'GLOBAL',
    sentiment: 'BEARISH',
    published_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'news_5',
    title: 'Índices Sintéticos de Volatilidade 50 e 100 operam com forte reversão à média',
    summary: 'Algoritmos de precificação Ornstein-Uhlenbeck mantêm dispersão controlada em conformidade com o modelo matemático OTC.',
    source: 'Trading Systems Daily',
    url: 'https://investing.com',
    category: 'INDICES',
    sentiment: 'NEUTRAL',
    published_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];
