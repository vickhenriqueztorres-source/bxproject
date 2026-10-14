import React from 'react';
import { useTranslation } from '../i18n';
import { LanguageSelectorDropdown } from '../components/header/LanguageSelectorDropdown';

export const GeoblockedPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      data-testid="geoblocked-page"
      style={{
        minHeight: '100vh',
        background: '#0B0E14',
        color: '#F4F5F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Geist', sans-serif",
      }}
    >
      <div
        style={{
          background: '#101622',
          border: '1px solid rgba(229, 72, 77, 0.35)',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <LanguageSelectorDropdown />
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '4px',
            background: 'rgba(246, 195, 68, 0.14)',
            color: '#F6C344',
            fontSize: '11px',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          {t('common.demo_banner')}
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#F4F5F7' }}>
          {t('geoblock.title')}
        </h1>
        <p style={{ fontSize: '13.5px', color: '#8A92A1', lineHeight: 1.5, marginBottom: '12px' }}>
          {t('geoblock.message')}
        </p>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#22C55E', marginBottom: '16px' }}>
          🇧🇷 🇲🇽 🇨🇴 🇦🇷 🇨🇱 🇵🇪 {t('geoblock.countries')}
        </p>
        <p style={{ fontSize: '12px', color: '#8A92A1', marginBottom: '24px' }}>
          {t('geoblock.support')}
        </p>
        <button
          type="button"
          data-testid="geoblock-retry-btn"
          onClick={() => window.location.reload()}
          style={{
            background: '#22C55E',
            color: '#0B0E14',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('geoblock.button_retry')}
        </button>
      </div>
    </div>
  );
};
