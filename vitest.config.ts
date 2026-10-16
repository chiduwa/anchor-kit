import { defineConfig } from 'vitest/config';

// The TestNet suite spends real (test) ALGO and needs a funded account, so it
// runs only when asked for: `npm run test:testnet`.
const testnet = process.env.ANCHOR_TESTNET === '1';

export default defineConfig({
  test: {
    include: testnet ? ['test/testnet.test.ts'] : ['test/**/*.test.ts'],
    exclude: testnet ? [] : ['test/testnet.test.ts'],
    testTimeout: testnet ? 120_000 : 5_000,
  },
});
