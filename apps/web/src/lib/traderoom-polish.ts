/**
 * Chave TRADEROOM_POLISH — acabamento profissional da sala de operação.
 * Independente de NEW_TRADEROOM. Padrão ligado; `?polish=0` devolve a sala anterior.
 * Ordem: memória > URL (?polish=0|1) > localStorage > VITE_TRADEROOM_POLISH > padrão.
 */

const STORAGE_KEY = 'TRADEROOM_POLISH';
let memoryFlag: boolean | null = null;

function readStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : (globalThis as any).localStorage;
  } catch {
    return undefined;
  }
}

export function isTraderoomPolishEnabled(): boolean {
  if (memoryFlag !== null) return memoryFlag;

  try {
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;
    const search: string | undefined = win?.location?.search;
    if (search) {
      // Só os valores exatos 0/1 são aceitos; qualquer outro é ignorado.
      const param = new URLSearchParams(search).get('polish');
      if (param === '1') return true;
      if (param === '0') return false;
    }

    const stored = readStorage()?.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;

    const envFlag = (import.meta as any)?.env?.VITE_TRADEROOM_POLISH;
    if (envFlag === 'true') return true;
    if (envFlag === 'false') return false;
  } catch {
    // Ambiente restrito: mantém o padrão
  }

  return true;
}

export function setTraderoomPolishEnabled(enabled: boolean): void {
  memoryFlag = enabled;
  try {
    readStorage()?.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function resetTraderoomPolishForTesting(): void {
  memoryFlag = null;
}
