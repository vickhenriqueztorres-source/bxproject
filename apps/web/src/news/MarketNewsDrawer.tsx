import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketNews } from '../api/client';
import type { NewsCategory, NewsSentiment } from './news-types';

export interface MarketNewsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - Date.parse(isoString);
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `há ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} d`;
}

function getSentimentBadge(sentiment: NewsSentiment) {
  switch (sentiment) {
    case 'BULLISH':
      return { label: '🟢 ALTA', color: '#00e676', bg: 'rgba(0, 230, 118, 0.12)' };
    case 'BEARISH':
      return { label: '🔴 BAIXA', color: '#ff3d71', bg: 'rgba(255, 61, 113, 0.12)' };
    default:
      return { label: '⚪ NEUTRO', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' };
  }
}

export function MarketNewsDrawer({ isOpen, onClose }: MarketNewsDrawerProps) {
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
    { id: 'FOREX', label: 'Câmbio / Forex' },
    { id: 'GLOBAL', label: 'Economia Global' },
  ];

  const filteredNews = news.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid #1f2e4b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0a0f1d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📰</span>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0 }}>
              Notícias do Mercado
            </h2>
            <small style={{ fontSize: '10px', color: '#687b99' }}>
              Feed financeiro global e sentimento
            </small>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => void refetch()}
            style={{
              background: '#162238',
              border: '1px solid #233555',
              borderRadius: '6px',
              color: '#8ea2c2',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            title="Atualizar Notícias"
          >
            🔄
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8ea2c2',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            title="Fechar aba"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div style={{ padding: '12px 18px 8px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar notícias..."
          style={{
            width: '100%',
            background: '#080d1a',
            border: '1px solid #1f2e4b',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filtros por Categoria (Pills) */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '4px 18px 12px',
          overflowX: 'auto',
          borderBottom: '1px solid #172238',
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              background: selectedCategory === cat.id ? '#1e3052' : '#0e172a',
              border: '1px solid ' + (selectedCategory === cat.id ? '#3b82f6' : '#1e293b'),
              color: selectedCategory === cat.id ? '#60a5fa' : '#8898b8',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Lista de Notícias */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#687b99', fontSize: '12px' }}>
            Carregando notícias financeiras...
          </div>
        ) : filteredNews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#687b99', fontSize: '12px' }}>
            Nenhuma notícia encontrada nesta categoria.
          </div>
        ) : (
          filteredNews.map((article) => {
            const badge = getSentimentBadge(article.sentiment);
            return (
              <div
                key={article.id}
                style={{
                  background: '#101a2f',
                  border: '1px solid #1f2e4b',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Metadados: Fonte, Hora e Sentimento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8' }}>
                      {article.source}
                    </span>
                    <span style={{ fontSize: '10px', color: '#566a87' }}>•</span>
                    <span style={{ fontSize: '10px', color: '#7b8da7' }}>
                      {formatRelativeTime(article.published_at)}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      color: badge.color,
                      background: badge.bg,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${badge.color}33`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Título */}
                <h3
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#f1f5f9',
                    lineHeight: '1.4',
                    margin: 0,
                  }}
                >
                  {article.title}
                </h3>

                {/* Resumo */}
                <p
                  style={{
                    fontSize: '11px',
                    color: '#8295b3',
                    lineHeight: '1.5',
                    margin: 0,
                  }}
                >
                  {article.summary}
                </p>

                {/* Link para Matéria */}
                <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '10px',
                      color: '#60a5fa',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Ler matéria original ↗
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
