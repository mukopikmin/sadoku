import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  define: command === "build"
    ? {
      "process.env.NODE_ENV": JSON.stringify("production"),
    }
    : undefined,
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: true,
    manifest: true,
    outDir: resolve(import.meta.dirname, "dist"),
    rollupOptions: {
      input: resolve(import.meta.dirname, "main.tsx"),
      output: {
        assetFileNames: "[name]-[hash][extname]",
        chunkFileNames: "[name]-[hash].js",
        entryFileNames: "client-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    testTimeout: 10_000,
  },
}));
