/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // يسمح بتشغيل نسخة ثانية على منفذ حرّ بدل التعارض
    port: Number(process.env.PORT) || 5173,
  },
  resolve: {
    alias: {
      "@core": r("./src/core"),
      "@application": r("./src/application"),
      "@infrastructure": r("./src/infrastructure"),
      "@presentation": r("./src/presentation"),
      "@config": r("./src/config"),
      "@i18n": r("./src/i18n"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
