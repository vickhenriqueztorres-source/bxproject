const STORAGE_KEY = 'binmax:joined-tournaments:v1';
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype']);

let memoryStore = new Set<string>();

export function isValidTournamentId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!SAFE_ID_REGEX.test(trimmed)) return false;
  if (FORBIDDEN_IDS.has(trimmed.toLowerCase())) return false;
  return true;
}

export function getJoinedTournamentIds(): string[] {
  const result = new Set<string>(memoryStore);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (isValidTournamentId(item)) {
              result.add(item.trim());
            }
          }
        }
      }
    }
  } catch {
    // Fallback silencioso para memoryStore caso localStorage esteja bloqueado ou corrompido
  }
  memoryStore = result;
  return Array.from(result);
}

export function isTournamentJoined(id: unknown): boolean {
  if (!isValidTournamentId(id)) return false;
  const joined = getJoinedTournamentIds();
  return joined.includes(id.trim());
}

export function joinTournamentLocal(id: unknown): {
  success: boolean;
  alreadyJoined: boolean;
  joinedIds: string[];
} {
  if (!isValidTournamentId(id)) {
    return {
      success: false,
      alreadyJoined: false,
      joinedIds: getJoinedTournamentIds(),
    };
  }

  const normalizedId = id.trim();
  const current = new Set<string>(getJoinedTournamentIds());
  const alreadyJoined = current.has(normalizedId);
  current.add(normalizedId);
  memoryStore = current;

  const joinedIds = Array.from(current);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(joinedIds));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('binmax:tournaments-updated', { detail: { joinedIds } }));
    }
  } catch {
    // Mantém em memória se localStorage lançar QuotaExceededError/SecurityError
  }

  return {
    success: true,
    alreadyJoined,
    joinedIds,
  };
}

export function resetJoinedTournamentsForTesting(): void {
  memoryStore = new Set<string>();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
