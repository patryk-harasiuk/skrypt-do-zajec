import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.tsbuildinfo', 'fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Warstwa core nie może zależeć od DOM ani od Lit.
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lit', 'lit/*', 'lit-html', '@lit/*'],
              message: 'packages/core nie może importować Lit (headless core).',
            },
          ],
        },
      ],
    },
  },
);
