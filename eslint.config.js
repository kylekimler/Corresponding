import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'reports/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: { security },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        browser: 'readonly',
        defineContentScript: 'readonly',
      },
    },
    rules: {
      ...security.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Extension messaging and DOM adapters intentionally use unknown boundaries.
      '@typescript-eslint/no-explicit-any': 'off',
      // Security plugin: non-literal regexp from controlled catalogs is OK.
      'security/detect-non-literal-regexp': 'off',
      'security/detect-object-injection': 'off',
      // Local fixture corpus loader only; paths are repo-controlled.
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
);
