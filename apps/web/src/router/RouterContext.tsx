import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export interface RouterContextValue {
  currentPath: string;
  searchParams: URLSearchParams;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '') return '/';
  const clean = rawPath.split('?')[0].split('#')[0];
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname);
    }
    return '/';
  });

  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    const [pathname, search] = to.split('?');
    const normalized = normalizePath(pathname);
    const fullUrl = search !== undefined ? `${normalized}?${search}` : normalized;

    if (options?.replace) {
      window.history.replaceState(null, '', fullUrl);
    } else {
      window.history.pushState(null, '', fullUrl);
    }

    setCurrentPath(normalized);
    setSearchParams(new URLSearchParams(search || ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const value = useMemo(
    () => ({
      currentPath,
      searchParams,
      navigate,
    }),
    [currentPath, searchParams, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    // Fallback gracioso se renderizado fora do provider (ex: em testes isolados)
    return {
      currentPath: typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/',
      searchParams: typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams(),
      navigate: (to: string) => {
        if (typeof window !== 'undefined') window.history.pushState(null, '', to);
      },
    };
  }
  return context;
}
