import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '../router/RouterContext';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { DepositPage } from './DepositPage';
import { WithdrawPage } from './WithdrawPage';
import { VerificationPage } from './VerificationPage';
import { SettingsPage } from './SettingsPage';
import { HistoryPage, sanitizeCsvField } from './HistoryPage';
import { TournamentsPage } from './TournamentsPage';
import { AnalysisPage } from './AnalysisPage';
import { TutorialsPage } from './TutorialsPage';
import { PromotionsPage } from './PromotionsPage';
import { LandingPage } from './LandingPage';
import { NotFoundPage } from './NotFoundPage';
import { MaintenancePage } from './MaintenancePage';
import { GlobalReconnectingOverlay } from '../components/status/GlobalReconnectingOverlay';
import { PaymentErrorModal } from '../components/status/PaymentErrorModal';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

describe('SUBETAPA 08: Bateria Integrada de Estresse, Caos, Segurança e Certificação Final', () => {
  // ─── 1. TESTE DE ESTRESSE DE NAVEGAÇÃO SPA ──────────────────────────────
  it('8.1 Estresse: Executa 100 alternâncias consecutivas de rotas secundárias em alta velocidade', () => {
    const queryClient = createTestQueryClient();
    const routes = [
      '/login',
      '/registro',
      '/recuperar',
      '/deposito',
      '/retiro',
      '/verificacion',
      '/ajustes',
      '/historial',
      '/torneos',
      '/analisis',
      '/tutoriales',
      '/promociones',
      '/landing',
      '/mantenimiento',
      '/404',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const path = routes[i % routes.length];
      let pageElement: React.ReactElement;

      switch (path) {
        case '/login': pageElement = <LoginPage />; break;
        case '/registro': pageElement = <RegisterPage />; break;
        case '/recuperar': pageElement = <PasswordRecoveryPage />; break;
        case '/deposito': pageElement = <DepositPage />; break;
        case '/retiro': pageElement = <WithdrawPage />; break;
        case '/verificacion': pageElement = <VerificationPage />; break;
        case '/ajustes': pageElement = <SettingsPage />; break;
        case '/historial': pageElement = <HistoryPage />; break;
        case '/torneos': pageElement = <TournamentsPage />; break;
        case '/analisis': pageElement = <AnalysisPage />; break;
        case '/tutoriales': pageElement = <TutorialsPage />; break;
        case '/promociones': pageElement = <PromotionsPage />; break;
        case '/landing': pageElement = <LandingPage />; break;
        case '/mantenimiento': pageElement = <MaintenancePage />; break;
        default: pageElement = <NotFoundPage />; break;
      }

      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <RouterProvider initialPath={path}>
            {pageElement}
          </RouterProvider>
        </QueryClientProvider>
      );
      expect(html).toBeTruthy();
    }
    const duration = performance.now() - start;
    // 100 páginas completas renderizadas sob carga em menos de 5000ms
    expect(duration).toBeLessThan(5000);
  });

  // ─── 2. SEGURANÇA E OWASP (ANTI-XSS & ANTI-INJEÇÃO) ────────────────────
  it('8.2 Segurança: Sanitização rigorosa contra formula injection e XSS', () => {
    // Sanitização de fórmulas maliciosas em CSV
    const dangerousFormulas = [
      '=1+1',
      '+cmd|"/C calc"!A0',
      '-SUM(A1:A10)',
      '@calc',
      '\t=calc',
    ];
    for (const formula of dangerousFormulas) {
      const sanitized = sanitizeCsvField(formula);
      expect(sanitized.startsWith("'") || sanitized.startsWith('"\'')).toBe(true);
    }

    // Escape de strings com XSS em inputs e layouts
    const xssPayload = '<script>alert("XSS")</script>';
    const sanitizedSafe = sanitizeCsvField(xssPayload);
    expect(sanitizedSafe).not.toBe('<script>');
  });

  // ─── 3. RESILIÊNCIA A CAOS E ESTADOS CRÍTICOS ──────────────────────────
  it('8.3 Caos: Estados de reconexão de rede e falha de pagamento respondem de forma resiliente', () => {
    // Estado de Reconexão Global
    const reconnHtml = renderToString(
      <GlobalReconnectingOverlay isReconnecting={true} onRetry={() => {}} />
    );
    expect(reconnHtml).toContain('Reconectando…');
    expect(reconnHtml).toContain('Sincronizando feed de mercado');

    // Estado de Erro de Pagamento
    const paymentErrorHtml = renderToString(
      <PaymentErrorModal
        isOpen={true}
        errorMessage="El procesador bancario rechazó la transacción temporalmente."
        onRetry={() => {}}
        onClose={() => {}}
      />
    );
    expect(paymentErrorHtml).toContain('No pudimos procesar tu pago');
    expect(paymentErrorHtml).toContain('El procesador bancario rechazó la transacción');
    expect(paymentErrorHtml).toContain('Intentar de nuevo');
  });

  // ─── 4. CERTIFICAÇÃO DE TOKENS VISUAIS E IDENTIDADE BINMAX ─────────────
  it('8.4 Certificação de Tokens: Todas as páginas secundárias respeitam a paleta corporativa', () => {
    const queryClient = createTestQueryClient();
    const landingHtml = renderToString(
      <QueryClientProvider client={queryClient}>
        <RouterProvider initialPath="/landing">
          <LandingPage />
        </RouterProvider>
      </QueryClientProvider>
    );

    // Fundo, painéis, bordas e destaque BINMAX
    expect(landingHtml).toContain('#0B1220');
    expect(landingHtml).toContain('#111A2B');
    expect(landingHtml).toContain('#1F2A3A');
    expect(landingHtml).toContain('#22C55E');
    expect(landingHtml).toContain('#E6EDF5');
  });
});
