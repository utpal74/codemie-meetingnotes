module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  globalSetup: './__tests__/setup/globalSetup.js',
  globalTeardown: './__tests__/setup/globalTeardown.js',
  setupFiles: ['./__tests__/setup/testEnv.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text', 'lcov'],
  verbose: true,
};
