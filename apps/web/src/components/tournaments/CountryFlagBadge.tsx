import React from 'react';

export interface CountryFlagBadgeProps {
  countryCode: string;
}

export function CountryFlagBadge({ countryCode }: CountryFlagBadgeProps) {
  const code = (countryCode || '').toUpperCase();

  return (
    <span
      data-testid={`country-flag-${code.toLowerCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10.5px',
        fontWeight: 700,
        fontFamily: "'Geist Mono', monospace",
        color: '#8A92A1',
        backgroundColor: '#121721',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '3px',
        padding: '1px 5px',
        lineHeight: 1.2,
        letterSpacing: '0.04em',
      }}
    >
      {code}
    </span>
  );
}
