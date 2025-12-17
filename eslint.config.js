const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", "jest.setup.js", "jest.config.js"],
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.setup.{js,jsx,ts,tsx}', 'jest.*.js', 'jest.setup.js', '__tests__/**/*'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      'import/namespace': 'off',
      'import/no-unresolved': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-duplicates': 'off',
      '@tanstack/query/exhaustive-deps': 'warn',
    },
  },
];
