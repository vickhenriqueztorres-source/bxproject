import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { I18nProvider } from './i18n';
import './styles.css';
import './styles/tokens-precision.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1,
  staleTime: 2000, refetchOnWindowFocus: true } } });
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
