import type { DrawingItem } from './drawing-types';

const VALID_DRAWING_TYPES = new Set([
  'line',
  'trend_line',
  'horizontal_line',
  'vertical_line',
  'fibonacci',
]);

const SAFE_COLOR_REGEX = /^#([0-9a-fA-F]{3,8})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;

/**
 * Valida e sanitiza um item geométrico de desenho individual.
 * Descarta coordenadas corrompidas (NaN, Infinity, preços <= 0) e sanitiza cores contra injection.
 */
export function validateDrawingItem(raw: unknown): DrawingItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const item = raw as Partial<DrawingItem>;

  if (typeof item.id !== 'string' || !item.id.trim()) return null;
  if (!item.type || !VALID_DRAWING_TYPES.has(item.type)) return null;

  // Validação estrita do Ponto 1 (p1)
  if (!item.p1 || typeof item.p1 !== 'object') return null;
  const p1Time = Number(item.p1.time);
  const p1Price = Number(item.p1.price);

  if (!Number.isFinite(p1Time) || p1Time <= 0 || !Number.isFinite(p1Price) || p1Price <= 0) {
    return null;
  }

  // Validação do Ponto 2 (p2) caso exista
  let safeP2 = undefined;
  if (item.p2 && typeof item.p2 === 'object') {
    const p2Time = Number(item.p2.time);
    const p2Price = Number(item.p2.price);
    if (Number.isFinite(p2Time) && p2Time > 0 && Number.isFinite(p2Price) && p2Price > 0) {
      safeP2 = {
        time: p2Time as any,
        price: p2Price,
        logical: typeof item.p2.logical === 'number' && Number.isFinite(item.p2.logical) ? item.p2.logical : undefined,
      };
    }
  }

  // Sanitização de cor
  let safeColor = '#22C47A';
  if (typeof item.color === 'string' && SAFE_COLOR_REGEX.test(item.color.trim())) {
    safeColor = item.color.trim();
  }

  // Sanitização de largura de traço (clamped entre 1 e 8)
  const rawWidth = Number(item.lineWidth);
  const safeWidth = Number.isFinite(rawWidth) ? Math.max(1, Math.min(8, Math.round(rawWidth))) : 1;

  return {
    id: item.id.trim(),
    type: item.type,
    p1: {
      time: p1Time as any,
      price: p1Price,
      logical: typeof item.p1.logical === 'number' && Number.isFinite(item.p1.logical) ? item.p1.logical : undefined,
    },
    p2: safeP2,
    color: safeColor,
    lineWidth: safeWidth,
    label: typeof item.label === 'string' ? item.label.slice(0, 32) : undefined,
  };
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

/**
 * Carrega desenhos persistidos para o ativo de forma 100% segura.
 * Nunca lança exceção em JSON corrompido ou entradas inválidas.
 */
export function loadSafeDrawings(symbol: string): DrawingItem[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem('broker_drawings_' + symbol);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const clean: DrawingItem[] = [];
    for (const item of parsed) {
      const valid = validateDrawingItem(item);
      if (valid) {
        clean.push(valid);
      }
    }
    return clean;
  } catch {
    return [];
  }
}

/**
 * Salva desenhos no localStorage com proteção contra estouro de cota (QuotaExceededError).
 */
export function saveSafeDrawings(symbol: string, drawings: DrawingItem[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const cleanDrawings = drawings
      .map(validateDrawingItem)
      .filter((d): d is DrawingItem => d !== null);

    storage.setItem('broker_drawings_' + symbol, JSON.stringify(cleanDrawings));
  } catch (err: unknown) {
    // Se a cota do localStorage estourar, limpa chaves de desenhos antigas de outros símbolos
    if (err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('[DrawingSanitizer] LocalStorage Quota Exceeded — limpando cache de desenhos de outros ativos');
      try {
        for (let i = storage.length - 1; i >= 0; i--) {
          const key = storage.key(i);
          if (key && key.startsWith('broker_drawings_') && key !== 'broker_drawings_' + symbol) {
            storage.removeItem(key);
          }
        }
        storage.setItem('broker_drawings_' + symbol, JSON.stringify(drawings));
      } catch {
        // Falha silenciosa defensiva
      }
    }
  }
}
