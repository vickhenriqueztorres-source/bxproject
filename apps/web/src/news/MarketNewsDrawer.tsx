import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketNews } from '../api/client';
import type { NewsCategory, NewsSentiment } from './news-types';

export interface MarketNewsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(isoString: string): string {
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return 'hace 1 min';
  const diffMs = Math.max(0, Date.now() - parsed);
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

function getSentimentBadge(sentiment: NewsSentiment) {
  switch (sentiment) {
    case 'BULLISH':
      return {
        label: 'ALCISTA',
        dotColor: '#22C47A',
        color: '#22C47A',
        bg: 'rgba(34, 196, 122, 0.10)',
        border: 'rgba(34, 196, 122, 0.26)',
      };
    case 'BEARISH':
      return {
        label: 'BAJISTA',
        dotColor: '#F2545B',
        color: '#F2545B',
        bg: 'rgba(242, 84, 91, 0.10)',
        border: 'rgba(242, 84, 91, 0.26)',
      };
    default:
      return {
        label: 'NEUTRAL',
        dotColor: '#8A92A1',
        color: '#9BA3B2',
        bg: 'rgba(138, 146, 161, 0.10)',
        border: 'rgba(138, 146, 161, 0.22)',
      };
  }
}

function sanitizeExternalUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function MarketNewsDrawer({ isOpen }: MarketNewsDrawerProps) {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: news = [], isLoading, refetch } = useQuery({
    queryKey: ['market-news', selectedCategory],
    queryFn: () => getMarketNews(selectedCategory),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (!isOpen) return null;

  const categories: { id: NewsCategory; label: string }[] = [
    { id: 'ALL', label: 'Todas' },
    { id: 'INDICES', label: 'Índices' },
    { id: 'CRYPTO', label: 'Cripto' },
    { id: 'FOREX', label: 'Forex' },
    { id: 'GLOBAL', label: 'Macro' },
  ];

  const safeNews = Array.isArray(news) ? news : [];
  const filteredNews = safeNews.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(item.title ?? '').toLowerCase().includes(q) ||
      String(item.summary ?? '').toLowerCase().includes(q) ||
      String(item.source ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      data-testid="market-news-drawer"
      className="bm-stealth-scroll"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        fontFamily: "'Geist', sans-serif",
        color: '#F4F5F7',
        overflowX: 'hidden',
      }}
    >
      {/* Barra de Pesquisa + Botão Atualizar Compacto (Sem Cabeçalho Duplicado) */}
      <div
        style={{
          padding: '12px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            data-testid="market-news-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar noticias o activos..."
            style={{
              width: '100%',
              background: '#0B0E14',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '7px 10px',
              color: '#F4F5F7',
              fontSize: '12px',
              fontFamily: "'Geist', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="button"
          data-testid="market-news-refresh"
          onClick={() => void refetch()}
          style={{
            background: '#151D2B',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            color: '#9BA3B2',
            width: '32px',
            height: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
          title="Actualizar análisis"
          aria-label="Actualizar análisis"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>

      {/* Filtros por Categoria (Pills com flexWrap e bm-no-scrollbar — Zero Scroll Horizontal) */}
      <div
        data-testid="market-news-categories"
        className="bm-no-scrollbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '4px 16px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          overflowX: 'hidden',
        }}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              data-testid={`news-category-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                background: isSelected ? 'rgba(34, 196, 122, 0.14)' : '#101622',
                border: `1px solid ${isSelected ? 'rgba(34, 196, 122, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                color: isSelected ? '#22C47A' : '#8A92A1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: isSelected ? 700 : 600,
                fontFamily: "'Geist', sans-serif",
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Lista de Notícias */}
      <div
        data-testid="market-news-list"
        className="bm-stealth-scroll"
        style={{
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflowX: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#8A92A1', fontSize: '12px' }}>
            Cargando análisis de mercado...
          </div>
        ) : filteredNews.length === 0 ? (
          <div
            data-testid="market-news-empty"
            style={{ textAlign: 'center', padding: '32px 0', color: '#8A92A1', fontSize: '12px' }}
          >
            No se encontraron noticias en esta categoría.
          </div>
        ) : (
          filteredNews.map((article, idx) => {
            const badge = getSentimentBadge(article.sentiment);
            const safeUrl = sanitizeExternalUrl(article.url);
            return (
              <div
                key={article.id || `news-${idx}`}
                data-testid={`market-news-card-${article.id || idx}`}
                style={{
                  background: '#151D2B',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Metadados: Fonte, Hora e Sentimento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#DCE1EA',
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {article.source || 'BINMAX RESEARCH'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#5A6578' }}>•</span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#8A92A1',
                        fontFamily: "'Geist Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRelativeTime(article.published_at)}
                    </span>
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${badge.border}`,
                      letterSpacing: '0.03em',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: badge.dotColor,
                        display: 'inline-block',
                      }}
                    />
                    {badge.label}
                  </span>
                </div>

                {/* Título */}
                <h3
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#F4F5F7',
                    lineHeight: '1.4',
                    margin: 0,
                  }}
                >
                  {article.title}
                </h3>

                {/* Resumo */}
                <p
                  style={{
                    fontSize: '11.5px',
                    color: '#8A92A1',
                    lineHeight: '1.48',
                    margin: 0,
                  }}
                >
                  {article.summary}
                </p>

                {/* Link para Matéria */}
                {safeUrl && (
                  <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '10.5px',
                        color: '#22C47A',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Ver fuente ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
