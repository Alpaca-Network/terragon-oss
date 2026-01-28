import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    silent: "passed-only",
    // Exclude integration tests that require built packages and real sandboxes
    // These can be run with:
    //   pnpm test-sandbox-provider (for sandbox.test.ts)
    //   pnpm test-sandbox-image (for sandbox-image.test.ts)
    exclude: [
      "**/node_modules/**",
      "**/sandbox.test.ts",
      "**/sandbox-image.test.ts",
    ],
  },
  resolve: {
    alias: {
      // Mock @terragon/bundled and @terragon/sandbox-image for unit tests
      // These packages require building before they can be used,
      // so we use mocks to allow unit tests to run without build artifacts
      "@terragon/bundled": path.resolve(
        __dirname,
        "src/__mocks__/@terragon/bundled.ts",
      ),
      "@terragon/sandbox-image": path.resolve(
        __dirname,
        "src/__mocks__/@terragon/sandbox-image.ts",
      ),
    },
  },
});
