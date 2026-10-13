/**
 * Feature Flags da Plataforma Binmax
 * Governa a ativação da nova sala de operações (NEW_TRADEROOM)
 * de forma isolada, resiliente e com fallback seguro.
 */

export const FEATURE_FLAGS = {
  NEW_TRADEROOM: 'NEW_TRADEROOM',
} as const;

let memoryFlag: boolean | null = null;

export function isNewTraderoomEnabled(): boolean {
  if (memoryFlag !== null) return memoryFlag;

  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (globalThis as any).localStorage;
    const win = typeof window !== 'undefined' ? window : (globalThis as any).window;

    if (win?.location?.search) {
      const params = new URLSearchParams(win.location.search);
      const themeParam = params.get('theme');
      const uiParam = params.get('ui');
      const flagParam = params.get('new_traderoom');

      if (themeParam === 'binmax' || uiParam === 'binmax' || flagParam === '1' || flagParam === 'true') {
        return true;
      }
      if (themeParam === 'legacy' || uiParam === 'legacy' || flagParam === '0' || flagParam === 'false') {
        return false;
      }
    }

    if (storage) {
      const stored = storage.getItem('NEW_TRADEROOM');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    }

    // Variável de ambiente Vite (opcional)
    const envFlag = (import.meta as any)?.env?.VITE_NEW_TRADEROOM;
    if (envFlag === 'true') return true;
    if (envFlag === 'false') return false;
  } catch {
    // Falha silenciosa em ambientes restritos, preservando estabilidade
  }

  // Padrão ativado para garantir o novo layout Turbo Prata
  return true;
}

export function setNewTraderoomEnabled(enabled: boolean): void {
  memoryFlag = enabled;
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : (globalThis as any).localStorage;
    if (storage) {
      storage.setItem('NEW_TRADEROOM', enabled ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
}

export const setFeatureFlagForTesting = setNewTraderoomEnabled;
