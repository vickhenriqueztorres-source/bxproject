import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TournamentsPage } from './TournamentsPage';
import { AnalysisPage } from './AnalysisPage';
import { TutorialsPage } from './TutorialsPage';
import { PromotionsPage } from './PromotionsPage';
import { RouterProvider } from '../router/RouterContext';

function renderWithRouter(ui: React.ReactElement, initialPath: string) {
  return renderToString(
    <RouterProvider initialPath={initialPath}>
      {ui}
    </RouterProvider>
  );
}

describe('SUBETAPA 06: Módulos de Engajamento — Torneos, Análisis, Tutoriales & Promociones', () => {
  it('6.1 TournamentsPage (/torneos): Renderiza grade de torneios, filtros, ranking e prêmios', () => {
    const html = renderWithRouter(<TournamentsPage />, '/torneos');

    expect(html).toContain('Torneos de Trading');
    expect(html).toContain('data-testid="filter-all"');
    expect(html).toContain('data-testid="filter-en_vivo"');
    expect(html).toContain('data-testid="filter-proximo"');
    expect(html).toContain('data-testid="filter-finalizado"');

    // Cards
    expect(html).toContain('Copa BINMAX');
    expect(html).toContain('$2,500');
    expect(html).toContain('Desafío de la Semana');

    // Detalhes do Torneio Selecionado
    expect(html).toContain('data-testid="tournament-details-panel"');
    expect(html).toContain('Reglas del Torneo');
    expect(html).toContain('Ranking en Vivo');
    expect(html).toContain('Tú (TraderPro)');
    expect(html).toContain('+285.43%');
    expect(html).toContain('Premios Oficiales');
    expect(html).toContain('$1,000 USD');
  });

  it('6.2 AnalysisPage (/analisis): Renderiza 4 métricas principais, barras diárias e estatísticas chave', () => {
    const html = renderWithRouter(<AnalysisPage />, '/analisis');

    expect(html).toContain('Análisis y Métricas Personales');
    expect(html).toContain('68.2%');
    expect(html).toContain('+$1,230.00');
    expect(html).toContain('4 WIN');
    expect(html).toContain('20:00 – 22:00');

    // Seções Gráficas
    expect(html).toContain('Resultado por día');
    expect(html).toContain('Resultado por activo');
    expect(html).toContain('Distribución de resultados');
    expect(html).toContain('137 ops (68.2%)');
    expect(html).toContain('Estadísticas clave');
    expect(html).toContain('3m 12s');
  });

  it('6.3 TutorialsPage (/tutoriales): Renderiza busca, categorias, aula destacada e leções', () => {
    const html = renderWithRouter(<TutorialsPage />, '/tutoriales');

    expect(html).toContain('Tutoriales y Academia de Trading');
    expect(html).toContain('data-testid="search-tutorials-input"');
    expect(html).toContain('data-testid="category-chip-ALL"');
    expect(html).toContain('data-testid="category-chip-Principiantes"');

    // Aula Destacada
    expect(html).toContain('data-testid="featured-tutorial-card"');
    expect(html).toContain('Cómo hacer tu primera operación');
    expect(html).toContain('03:24');

    // Grade de Leções
    expect(html).toContain('Entendiendo las velas japonesas y temporalidades');
    expect(html).toContain('Gestión de banca: la regla del 2%');
  });

  it('6.4 PromotionsPage (/promociones): Renderiza cartões institucionais, benefícios claros e selo de jogo limpo', () => {
    const html = renderWithRouter(<PromotionsPage />, '/promociones');

    expect(html).toContain('Promociones y Beneficios Institucionales');
    expect(html).toContain('data-testid="promo-card-promo-welcome"');
    expect(html).toContain('Bono de Bienvenida para Práctica');
    expect(html).toContain('$10.000 USD');

    expect(html).toContain('data-testid="promo-card-promo-cashback"');
    expect(html).toContain('Cashback Semanal del 10%');

    expect(html).toContain('data-testid="promo-card-promo-tournament"');
    expect(html).toContain('Gran Torneo Mensual BINMAX');

    // Selo de Jogo Limpo
    expect(html).toContain('Compromiso de Juego Limpio y Transparencia');
  });
});
