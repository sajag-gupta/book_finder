import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.wrangler/',
      '.tools/',
      'coverage/',
      '.work/',
      '.review/',
      'out/',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/assets/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
