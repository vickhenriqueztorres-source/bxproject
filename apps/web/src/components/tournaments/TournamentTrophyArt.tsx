import React from 'react';
import { TournamentTrophyVariant } from './TournamentTypes';

export interface TournamentTrophyArtProps {
  variant: TournamentTrophyVariant;
  height?: number;
}

const TROPHY_IMAGES: Record<TournamentTrophyVariant, string> = {
  'gold-matrix': '/tournaments/gold.png',
  'silver': '/tournaments/silver.png',
  'bronze': '/tournaments/bronze.png',
  'mono-gray': '/tournaments/mono-gray.png',
};

export function TournamentTrophyArt({ variant, height = 110 }: TournamentTrophyArtProps) {
  const imageSrc = TROPHY_IMAGES[variant] || '/tournaments/mono-gray.png';
  const isFinished = variant === 'mono-gray';

  return (
    <div
      data-testid={`tournament-trophy-${variant}`}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        borderRadius: '8px',
      }}
    >
      {/* Imagem de fundo cinematográfica */}
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 40%',
          filter: isFinished ? 'saturate(0.3) brightness(0.6)' : 'none',
          transition: 'filter 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Gradiente inferior para fundir com o fundo do card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #0E131D 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
