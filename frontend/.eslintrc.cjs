/**
 * Frontend ESLint config — minimal, pragmatic. Uses the plugins already
 * in devDependencies (react, react-hooks, react-refresh). Focused on
 * catching real bugs (missing dependencies, unused variables, unused
 * disable directives) without a stylistic wall for existing code.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'node_modules', 'build', '.eslintrc.cjs'],
  rules: {
    // React 18 + Vite conventions
    'react/prop-types': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Common false positives for the codebase's style
    'react/no-unescaped-entities': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      // Exempt `React` — the codebase predates the automatic JSX runtime,
      // so a lot of files still `import React from 'react'`. Stripping
      // them all is out of scope for the v1.2.0 pre-tag pass. Anything
      // else prefixed with `_` is also exempt by convention.
      varsIgnorePattern: '^(_|React$)',
      caughtErrors: 'none',
    }],
  },
};
