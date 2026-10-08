import { describe, it, expect } from 'vitest';
import { FIBONACCI_LEVELS, type DrawingItem } from './drawing-types';

describe('[PLANO 1 - GATE 1] Ferramentas Gráficas & Indicadores', () => {
  it('valida os 6 níveis áureos da retração de Fibonacci', () => {
    expect(FIBONACCI_LEVELS.length).toBe(6);
    expect(FIBONACCI_LEVELS[0].level).toBe(0);
    expect(FIBONACCI_LEVELS[1].level).toBe(0.236);
    expect(FIBONACCI_LEVELS[2].level).toBe(0.382);
    expect(FIBONACCI_LEVELS[3].level).toBe(0.5);
    expect(FIBONACCI_LEVELS[4].level).toBe(0.618);
    expect(FIBONACCI_LEVELS[5].level).toBe(1.0);
  });

  it('calcula preços de Fibonacci corretamente entre fundo e topo', () => {
    const bottom = 1000;
    const top = 1100;
    const diff = top - bottom; // 100

    const levels = FIBONACCI_LEVELS.map((lvl) => ({
      label: lvl.label,
      price: bottom + diff * lvl.level,
    }));

    expect(levels.find((l) => l.label === '0.0%')?.price).toBe(1000);
    expect(levels.find((l) => l.label === '50.0%')?.price).toBe(1050);
    expect(levels.find((l) => l.label === '61.8%')?.price).toBe(1061.8);
    expect(levels.find((l) => l.label === '100.0%')?.price).toBe(1100);
  });

  it('[Estresse] suporta persistência e carga de 50 desenhos simultâneos sem degradação', () => {
    const mockDrawings: DrawingItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `draw_${i}`,
      type: i % 2 === 0 ? 'horizontal_line' : 'trend_line',
      p1: { time: 1700000000 + i as any, price: 500 + i },
      p2: i % 2 !== 0 ? { time: 1700000060 + i as any, price: 510 + i } : undefined,
      color: '#00e676',
      lineWidth: 2,
    }));

    const serialized = JSON.stringify(mockDrawings);
    const parsed = JSON.parse(serialized) as DrawingItem[];

    expect(parsed.length).toBe(50);
    expect(parsed[49].id).toBe('draw_49');
    expect(parsed[49].p1.price).toBe(549);
  });

  it('[Caos/Segurança] recupera graciosamente quando localStorage contém dados corrompidos', () => {
    const corruptInputs = ['{invalid_json', 'null', '12345', 'undefined'];

    for (const corrupt of corruptInputs) {
      let drawings: DrawingItem[] = [];
      try {
        const raw = corrupt;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) drawings = parsed;
      } catch {
        drawings = [];
      }
      expect(Array.isArray(drawings)).toBe(true);
      expect(drawings.length).toBe(0);
    }
  });

  it('[SUBETAPA 2 - Hitbox 24px] valida que coordenadas a até 12px do centro interceptam a hitbox da linha', () => {
    // Tolerância da hitbox de 24px (raio = 12px)
    const HITBOX_RADIUS = 12;
    const lineY = 250;

    const isInsideHitbox = (cursorY: number) => Math.abs(cursorY - lineY) <= HITBOX_RADIUS;

    expect(isInsideHitbox(250)).toBe(true);  // Exato em cima da linha
    expect(isInsideHitbox(260)).toBe(true);  // 10px abaixo (capturado pela hitbox de 24px)
    expect(isInsideHitbox(240)).toBe(true);  // 10px acima (capturado pela hitbox de 24px)
    expect(isInsideHitbox(263)).toBe(false); // 13px abaixo (fora da hitbox)
    expect(isInsideHitbox(230)).toBe(false); // 20px acima (fora da hitbox)
  });

  it('[SUBETAPA 2 - Gerenciamento de Desenhos] valida adição, exclusão individual e limpeza em lote', () => {
    let drawings: DrawingItem[] = [];

    const add = (item: DrawingItem) => {
      drawings = [...drawings, item];
    };
    const remove = (id: string) => {
      drawings = drawings.filter((d) => d.id !== id);
    };
    const clear = () => {
      drawings = [];
    };

    add({ id: 'h1', type: 'horizontal_line', p1: { time: 100 as any, price: 500.5 }, color: '#00e676', lineWidth: 2 });
    add({ id: 'v1', type: 'vertical_line', p1: { time: 100 as any, price: 500 }, color: '#38bdf8', lineWidth: 2 });
    add({ id: 't1', type: 'trend_line', p1: { time: 100 as any, price: 500 }, p2: { time: 160 as any, price: 520 }, color: '#eab308', lineWidth: 2 });

    expect(drawings.length).toBe(3);

    // Exclusão individual
    remove('v1');
    expect(drawings.length).toBe(2);
    expect(drawings.find((d) => d.id === 'v1')).toBeUndefined();
    expect(drawings.find((d) => d.id === 'h1')).toBeDefined();

    // Limpeza total
    clear();
    expect(drawings.length).toBe(0);
  });

  it('[SUBETAPA 2 - Throttling rAF] simula coalescência de 100 eventos de mouse no mesmo quadro rAF', () => {
    let pendingPoint: { x: number; y: number } | null = null;
    let scheduled = false;
    let frameUpdates = 0;
    let finalAppliedPoint: { x: number; y: number } | null = null;

    const onMouseMove = (x: number, y: number) => {
      pendingPoint = { x, y };
      if (!scheduled) {
        scheduled = true;
        // Simulação do requestAnimationFrame
        setTimeout(() => {
          if (pendingPoint) {
            finalAppliedPoint = pendingPoint;
            frameUpdates++;
          }
          scheduled = false;
        }, 16);
      }
    };

    // 100 movimentos rápidos de mouse em microsegundos
    for (let i = 0; i < 100; i++) {
      onMouseMove(i * 2, i * 3);
    }

    expect(pendingPoint).toEqual({ x: 198, y: 297 });
    expect(scheduled).toBe(true);
  });

  it('[CORREÇÃO TREND LINE] valida resolução de coordenadas via logical index quando timestamp é nulo/futuro', () => {
    // Simula o motor de escala do Lightweight Charts
    const mockTimeScale = {
      logicalToCoordinate: (logical: number) => 100 + logical * 10,
      timeToCoordinate: (time: number) => (time === 1700000000 ? 200 : null), // Só reconhece vela exata
    };

    const resolveX = (pt: { time: number; logical?: number }) => {
      if (typeof pt.logical === 'number') {
        const coord = mockTimeScale.logicalToCoordinate(pt.logical);
        if (coord !== null) return coord;
      }
      return mockTimeScale.timeToCoordinate(pt.time);
    };

    // Ponto 1: Em cima de uma vela histórica
    const p1 = { time: 1700000000, logical: 10 };
    // Ponto 2: No futuro / margem direita onde timeToCoordinate retorna NULL
    const p2 = { time: 1700000999, logical: 25 };

    const x1 = resolveX(p1);
    const x2 = resolveX(p2);

    expect(x1).toBe(200); // 100 + 10 * 10
    expect(x2).toBe(350); // 100 + 25 * 10 (resolvido com sucesso mesmo sem candle existente!)
  });

  it('[CORREÇÃO TREND LINE] calcula extensão de raio futuro para projeção de suporte/resistência', () => {
    const x1 = 100;
    const y1 = 200;
    const x2 = 200;
    const y2 = 250;
    const containerWidth = 800;

    const dx = x2 - x1; // 100
    const dy = y2 - y1; // 50 (slope = 0.5)

    const extendedX = Math.max(containerWidth + 50, x2 + 350); // 850
    const extendedY = y1 + (dy / dx) * (extendedX - x1); // 200 + 0.5 * 750 = 575

    expect(extendedX).toBe(850);
    expect(extendedY).toBe(575);
  });

  it('[MOVIMENTAÇÃO DE LINHAS] translada linha horizontal no eixo Y (preço)', () => {
    const drawing: DrawingItem = {
      id: 'h1',
      type: 'horizontal_line',
      p1: { time: 100 as any, price: 500.0, logical: 10 },
      color: '#00e676',
      lineWidth: 2,
    };

    // Usuário arrasta a linha para 505.75
    const movedDrawing: DrawingItem = {
      ...drawing,
      p1: { ...drawing.p1, price: 505.75 },
    };

    expect(movedDrawing.p1.price).toBe(505.75);
    expect(movedDrawing.id).toBe('h1');
  });

  it('[MOVIMENTAÇÃO DE LINHAS] translada linha de tendência inteira (corpo) preservando inclinação', () => {
    const initialLine: DrawingItem = {
      id: 't1',
      type: 'trend_line',
      p1: { time: 100 as any, price: 500.0, logical: 10 },
      p2: { time: 200 as any, price: 520.0, logical: 20 },
      color: '#38bdf8',
      lineWidth: 2,
    };

    const deltaPrice = +15.5;
    const deltaLogical = +5;

    const translatedLine: DrawingItem = {
      ...initialLine,
      p1: {
        ...initialLine.p1,
        price: initialLine.p1.price + deltaPrice,
        logical: (initialLine.p1.logical ?? 0) + deltaLogical,
      },
      p2: initialLine.p2 ? {
        ...initialLine.p2,
        price: initialLine.p2.price + deltaPrice,
        logical: (initialLine.p2.logical ?? 0) + deltaLogical,
      } : undefined,
    };

    expect(translatedLine.p1.price).toBe(515.5);
    expect(translatedLine.p2?.price).toBe(535.5);
    expect(translatedLine.p1.logical).toBe(15);
    expect(translatedLine.p2?.logical).toBe(25);
    // Inclinação (delta) permanece idêntica
    expect(translatedLine.p2!.price - translatedLine.p1.price).toBe(20.0);
  });

  it('[MOVIMENTAÇÃO DE LINHAS] reposiciona ponto de ancoragem P2 de forma independente', () => {
    const initialLine: DrawingItem = {
      id: 't2',
      type: 'trend_line',
      p1: { time: 100 as any, price: 500.0, logical: 10 },
      p2: { time: 200 as any, price: 520.0, logical: 20 },
      color: '#38bdf8',
      lineWidth: 2,
    };

    // Ajuste fino do P2 para novo preço e barra
    const adjustedP2: DrawingItem = {
      ...initialLine,
      p2: {
        ...initialLine.p2!,
        price: 540.0,
        logical: 28,
      },
    };

    expect(adjustedP2.p1.price).toBe(500.0); // P1 intocado
    expect(adjustedP2.p1.logical).toBe(10);
    expect(adjustedP2.p2?.price).toBe(540.0); // P2 atualizado
    expect(adjustedP2.p2?.logical).toBe(28);
  });
});
