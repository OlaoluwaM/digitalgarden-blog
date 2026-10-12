import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  // Pre-bundle lucide up front. Found on first import in a test, Vite would
  // optimize it mid-run and reload the page under the running test.
  optimizeDeps: { include: ["lucide"] },
  test: {
    include: ["test/browser/**/*.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: {
          executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH,
        },
        contextOptions: {
          permissions: ["clipboard-read", "clipboard-write"],
        },
      }),
      instances: [{ browser: "chromium" }],
    },
  },
});
