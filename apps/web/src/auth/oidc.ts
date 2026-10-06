import { InMemoryWebStorage, UserManager, WebStorageStateStore,
  type User } from 'oidc-client-ts';

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/indices';
const origin = window.location.origin;

export const userManager = new UserManager({
  authority,
  client_id: 'frontend',
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

export function isGuestMode(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem('synth_guest_mode') === 'true';
}

export function setGuestMode(enabled: boolean) {
  if (enabled) {
    sessionStorage.setItem('synth_guest_mode', 'true');
  } else {
    sessionStorage.removeItem('synth_guest_mode');
  }
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
  if (isGuestMode()) return 'demo-guest-token';
  let user = await userManager.getUser();
  if (!user || user.expired) user = await userManager.signinSilent();
  if (!user?.access_token) throw new Error('AUTH_REQUIRED');
  return user.access_token;
}

export async function signIn(symbol?: string) {
  await userManager.signinRedirect({ state: symbol ? { symbol } : undefined });
}
export async function signOut() {
  if (isGuestMode()) {
    setGuestMode(false);
    window.location.reload();
    return;
  }
  await userManager.signoutRedirect();
}
