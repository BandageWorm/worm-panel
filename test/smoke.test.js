// describe / it / expect 由 vitest 的 globals 注入，见 vitest.config.js
describe('测试骨架', () => {
  it('vitest 可在 CommonJS 代码库下运行', () => {
    expect(1 + 1).toBe(2);
  });
});
