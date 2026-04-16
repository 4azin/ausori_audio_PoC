import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  testTimeout: 15000,
  verbose: true,
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@smithy|@aws-sdk)/)",
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.jsx?$": ["ts-jest", { useESM: false }],
  },
};

export default config;
