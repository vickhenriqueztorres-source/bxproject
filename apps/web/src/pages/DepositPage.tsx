import React from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { BinmaxDepositModal } from '../wallet/BinmaxDepositModal';
import { useRouter } from '../router/RouterContext';
import { useQueryClient } from '@tanstack/react-query';

export function DepositPage() {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    navigate('/operar');
  };

  return (
    <SecondaryLayout>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <BinmaxDepositModal
          isOpen={true}
          onClose={() => navigate('/operar')}
          onDepositSuccess={handleSuccess}
        />
      </div>
    </SecondaryLayout>
  );
}
