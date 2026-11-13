import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    server: {
      // react-tweet's public entry point imports CSS alongside enrichTweet.
      deps: { inline: ["react-tweet"] },
    },
  },
});
