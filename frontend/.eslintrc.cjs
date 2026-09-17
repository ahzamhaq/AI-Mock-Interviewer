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
  overrides: [
    {
      // react-three-fiber renders its own intrinsic elements (mesh,
      // geometry, meshStandardMaterial, etc.) as real DOM-like JSX tags.
      // eslint-plugin-react doesn't know about them without the R3F ESLint
      // plugin, which isn't installed — scoped off here rather than adding
      // a new dependency for one file.
      files: ['src/components/avatar/AvatarScene.jsx'],
      rules: {
        'react/no-unknown-property': 'off',
      },
    },
    {
      // Context files intentionally co-export a Provider component and its
      // companion `useX` hook — the established pattern across this codebase.
      // Fast Refresh works fine for these in practice; splitting them into
      // separate files just to satisfy this heuristic isn't warranted.
      files: ['src/context/*.jsx'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};
