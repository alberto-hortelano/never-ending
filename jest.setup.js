// Set NODE_ENV to 'test' for all test runs
process.env.NODE_ENV = 'test';

// Mock import.meta.url for tests
global.import = {
  meta: {
    url: 'http://localhost/test.js'
  }
};