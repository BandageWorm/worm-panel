// ESLint 扁平配置：先以宽松规则覆盖后端 CommonJS 代码，避免引入大量存量报错。
// 前端 client/ 使用独立的 Vite 工具链，暂不纳入（后续可按需接入 vue 插件）。
const NODE_GLOBALS = {
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  AbortController: 'readonly'
};

const VITEST_GLOBALS = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  vi: 'readonly'
};

const COMMON_RULES = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-dupe-keys': 'error',
  'no-constant-condition': 'warn',
  'no-empty': ['error', { allowEmptyCatch: true }]
};

module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'client/**', 'data/**', 'openspec/**', '.codebuddy/**']
  },
  {
    files: ['src/**/*.js', 'app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: NODE_GLOBALS
    },
    rules: COMMON_RULES
  },
  {
    files: ['test/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: Object.assign({}, NODE_GLOBALS, VITEST_GLOBALS)
    },
    rules: COMMON_RULES
  }
];
