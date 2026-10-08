import { describe, expect, it } from 'vitest';
import { safeRandomUUID } from './uuid';

describe('[DEF-T13-1] geração de UUID resiliente a HTTP inseguro', () => {
  it('demonstra a causa raiz: chamada direta a crypto.randomUUID falha em HTTP inseguro', () => {
    const mockInsecureCrypto = {
      getRandomValues: (arr: Uint8Array) => arr,
      randomUUID: undefined,
    };
    expect(() => {
      // @ts-expect-error Simulação do código anterior: crypto.randomUUID()
      mockInsecureCrypto.randomUUID();
    }).toThrow(TypeError);
  });

  it('gera UUIDv4 padrão quando crypto.randomUUID está disponível', () => {
    const id = safeRandomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('gera UUIDv4 válido via getRandomValues quando crypto.randomUUID é undefined (HTTP inseguro / IP público)', () => {
    const originalCrypto = globalThis.crypto;
    try {
      // Simula navegador em contexto HTTP inseguro (ex: http://169.58.159.77/)
      // onde crypto.randomUUID é undefined por especificação W3C
      const mockCrypto = {
        getRandomValues: (arr: Uint8Array) => originalCrypto.getRandomValues(arr),
        randomUUID: undefined,
      };
      Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto,
        configurable: true,
      });

      const id = safeRandomUUID();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });

  it('gera UUIDv4 válido via fallback mesmo quando crypto é completamente indisponível', () => {
    const originalCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
      });

      const id = safeRandomUUID();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
    }
  });
});
