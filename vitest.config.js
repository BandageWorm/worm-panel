// Vitest 配置：只覆盖不依赖服务器环境（nginx / pm2 / ufw / acme.sh）的纯逻辑测试
//
// 说明：后端源码为 CommonJS，而 vitest 不允许在 CJS 里 require('vitest')。
// 因此开启 globals，测试文件无需导入 describe/it/expect，可直接用 CJS 的 require 引入被测模块。
module.exports = {
  test: {
    include: ['test/**/*.test.{js,mjs}'],
    environment: 'node',
    globals: true
  }
};
