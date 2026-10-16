import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.ts',
      'tests/integration/test-*.test.ts',
      'tests/chaos/phase2-chaos-scenarios.test.ts',
      'services/tick-engine/test/*.unit.test.ts',
      'services/candle-worker/core.unit.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/chaos/C-01-max-pairs.test.ts',
      'tests/chaos/chaos-scenarios.test.ts',
      'tests/chaos/ui-anti-casino-chaos.test.ts',
      'tests/math/**',
      'services/api/**',
      'services/settlement-worker/**',
      'services/wallet-adapter/**',
      'services/websocket-gateway/**',
    ],
  },
});
