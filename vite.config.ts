import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "node20",
    ssr: true,
    outDir: "dist",
    rollupOptions: {
      input: resolve(__dirname, "src/index.ts"),
      output: {
        entryFileNames: "[name].js",
        format: "esm",
      },
      external: [/node_modules/],
    },
  },
});
