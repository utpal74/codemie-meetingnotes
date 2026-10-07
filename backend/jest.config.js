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
  // Avoid hanging test runs due to open handles (e.g., prisma connection) when DB isn't available.
  // Individual tests should ensure prisma is disconnected when they use it.
  detectOpenHandles: true,
  forceExit: true,
};
