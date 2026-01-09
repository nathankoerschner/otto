import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // BANNED HOOKS - React Compiler handles optimization
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useEffect']",
          message:
            'useEffect is BANNED. Use TanStack Query for data fetching, Zustand for state subscriptions, or event handlers for side effects. See AGENTS.md for approved patterns.',
        },
        {
          selector: "CallExpression[callee.name='useMemo']",
          message:
            'useMemo is BANNED. React Compiler handles memoization automatically. See AGENTS.md for details.',
        },
        {
          selector: "CallExpression[callee.name='useCallback']",
          message:
            'useCallback is BANNED. React Compiler handles function memoization automatically. See AGENTS.md for details.',
        },
        {
          selector: "CallExpression[callee.name='useLayoutEffect']",
          message:
            'useLayoutEffect is BANNED. Use refs with event handlers or CSS for layout-dependent logic.',
        },
      ],

      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  {
    // Relaxed rules for test and story files
    files: ['**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}', '**/test-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Relaxed rules for shadcn/ui components (they export variants alongside components)
    files: ['**/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
