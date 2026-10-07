import { useEffect, useState, type RefObject } from 'react';

/**
 * Hook de Virtualização e Pausa sob Segundo Plano (Subetapa 5).
 * Detecta se a célula está no viewport (IntersectionObserver)
 * e se a aba está visível (document.visibilityState).
 */
export function useVisibilityPause(elementRef: RefObject<HTMLElement | null>): boolean {
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true
  );

  useEffect(() => {
    // 1. Monitorar visibilidade da aba do navegador (Page Visibility API)
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== 'hidden');
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 2. Monitorar interseção da célula no viewport (IntersectionObserver API)
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && elementRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setIsIntersecting(entry.isIntersecting);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(elementRef.current);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [elementRef]);

  return isIntersecting && isTabVisible;
}
