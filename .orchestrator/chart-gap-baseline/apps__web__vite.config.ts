import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {} // Isola do postcss da raiz
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3005",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://127.0.0.1:3006",
        rewrite: (path) => path.replace(/^\/ws/, "/ticks"),
        ws: true
      }
    }
  }
});
