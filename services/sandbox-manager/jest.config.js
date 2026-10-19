module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testRegex: 'test/.*\\.test\\.ts$',
  testTimeout: 120000,
};
