module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@vue/typescript/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    parser: '@typescript-eslint/parser',
    sourceType: 'module',
    project: './tsconfig.json', // 指向您的 TypeScript 配置文件
    extraFileExtensions: ['.vue'],
  },
  rules: {
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    'vue/no-unused-vars': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multi-word-component-names': 'off',
    'no-warning-comments': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['**/__tests__/*.{j,t}s?(x)', '**/tests/unit/**/*.spec.{j,t}s?(x)'],
      env: {
        jest: true,
      },
    },
  ]
};
