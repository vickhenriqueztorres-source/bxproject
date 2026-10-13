import { InMemoryWebStorage, UserManager, WebStorageStateStore,
  type User } from 'oidc-client-ts';

const defaultAuthority = typeof window !== 'undefined' && window.location
  ? `${window.location.origin}/realms/broker-demo`
  : 'http://localhost:8080/realms/broker-demo';
const authority = (import.meta as any).env?.VITE_OIDC_AUTHORITY ?? defaultAuthority;
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

export const userManager = new UserManager({
  authority,
  client_id: (import.meta as any).env?.VITE_OIDC_CLIENT_ID ?? 'broker-web',
  redirect_uri: `${origin}/callback`,
  post_logout_redirect_uri: origin,
  response_type: 'code',
  scope: 'openid profile email',
  loadUserInfo: false,
  automaticSilentRenew: true,
  accessTokenExpiringNotificationTimeInSeconds: 30,
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  // OIDC redirect state uses the library's transient session store. Tokens stay in userStore memory.
});

let callback: Promise<User> | null = null;
export function finishSignin(): Promise<User> {
  callback ??= userManager.signinRedirectCallback();
  return callback;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch { /* ignore */ }
  return null;
}

export function isGuestMode(): boolean {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('binmax_auth_session') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user) {
        return false;
      }
    }
    return getSafeStorage()?.getItem('synth_guest_mode') === 'true';
  } catch {
    return false;
  }
}

export function setGuestMode(enabled: boolean) {
  try {
    const storage = getSafeStorage();
    if (!storage) return;
    if (enabled) {
      storage.setItem('synth_guest_mode', 'true');
    } else {
      storage.removeItem('synth_guest_mode');
    }
  } catch { /* ignore */ }
}

export const guestUser: User = {
  profile: {
    sub: 'guest-demo-user',
    email: 'convidado@demo.local',
    name: 'Trader Convidado Demo',
  },
  access_token: 'demo-guest-token',
  expires_at: Math.floor(Date.now() / 1000) + 86400,
} as unknown as User;

export async function accessToken(): Promise<string> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('binmax_auth_session') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token) return parsed.token;
    }
  } catch { /* ignore */ }

  if (isGuestMode()) return 'demo-guest-token';
  let user = await userManager.getUser();
  if (!user || user.expired) user = await userManager.signinSilent();
  if (!user?.access_token) throw new Error('AUTH_REQUIRED');
  return user.access_token;
}

export async function signIn(symbol?: string) {
  await userManager.signinRedirect({ state: symbol ? { symbol } : undefined });
}
export async function signOut(redirectTo: string = '/') {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('binmax_auth_session');
      window.sessionStorage.removeItem('synth_guest_mode');
    }
  } catch { /* ignore */ }

  setGuestMode(false);

  try {
    const oidcUser = await userManager.getUser();
    if (oidcUser?.id_token) {
      await userManager.signoutRedirect({
        post_logout_redirect_uri: typeof window !== 'undefined' ? `${window.location.origin}${redirectTo}` : undefined,
      });
      return;
    }
    await userManager.removeUser();
  } catch { /* ignore */ }

  if (typeof window !== 'undefined') {
    try {
      if (typeof window.location.assign === 'function') {
        window.location.assign(redirectTo);
      } else {
        window.location.href = redirectTo;
      }
    } catch {
      window.location.pathname = redirectTo;
    }
  }
}
