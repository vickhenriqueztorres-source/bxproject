import React from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { BinmaxWithdrawModal } from '../wallet/BinmaxWithdrawModal';
import { useRouter } from '../router/RouterContext';
import { useQueryClient } from '@tanstack/react-query';

export function WithdrawPage() {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    navigate('/operar');
  };

  return (
    <SecondaryLayout>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <BinmaxWithdrawModal
          isOpen={true}
          onClose={() => navigate('/operar')}
          onWithdrawRequested={handleSuccess}
        />
      </div>
    </SecondaryLayout>
  );
}
