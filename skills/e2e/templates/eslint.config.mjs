import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['playwright-report/**', 'test-results/**', 'blob-report/**', 'ui-verify/**', 'eslint.config.mjs'] },
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A missing await makes Playwright tests pass or fail at random.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
);
