import React from 'react';
import type { CountryCode } from '@broker/shared';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { BinmaxDepositModal, getAvailableMethodsForCountry } from '../wallet/BinmaxDepositModal';
import { useRouter } from '../router/RouterContext';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../i18n';

export { getAvailableMethodsForCountry };

export function DepositPage({ countryOverride }: { countryOverride?: CountryCode | string } = {}) {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const i18n = typeof useTranslation === 'function' ? useTranslation() : null;
  const effectiveCountry = countryOverride || (i18n?.isI18nActive ? i18n.country : undefined);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    navigate('/operar');
  };

  return (
    <SecondaryLayout>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <BinmaxDepositModal
          isOpen={true}
          country={effectiveCountry}
          onClose={() => navigate('/operar')}
          onDepositSuccess={handleSuccess}
        />
      </div>
    </SecondaryLayout>
  );
}
