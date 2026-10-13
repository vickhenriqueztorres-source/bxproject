import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/src/**/*.unit.test.{ts,tsx}'],
    languageOptions: { globals: globals.node },
  },
);
