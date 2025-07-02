/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      }
    ]
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/src/**/__tests__/**/*.{ts,tsx}',
    '**/src/**/*.{spec,test}.{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/public/'
  ]
};
