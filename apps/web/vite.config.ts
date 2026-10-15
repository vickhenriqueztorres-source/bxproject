import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const useLocalDemoFeed = process.env.BROKER_DEV_FEED !== "0";

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
        target: useLocalDemoFeed ? "http://127.0.0.1:3001" : "http://127.0.0.1:3005",
        changeOrigin: true
      },
      "/ws": {
        target: useLocalDemoFeed ? "ws://127.0.0.1:3001" : "ws://127.0.0.1:3006",
        rewrite: (path) => path.replace(/^\/ws/, "/ticks"),
        ws: true
      }
    }
  },
  preview: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: useLocalDemoFeed ? "http://127.0.0.1:3001" : "http://127.0.0.1:3005",
        changeOrigin: true
      },
      "/ws": {
        target: useLocalDemoFeed ? "ws://127.0.0.1:3001" : "ws://127.0.0.1:3006",
        rewrite: (path) => path.replace(/^\/ws/, "/ticks"),
        ws: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("lightweight-charts")) return "vendor-charts";
          if (id.includes("gsap") || id.includes("lenis")) return "vendor-motion";
          if (id.includes("oidc-client-ts") || id.includes("@tanstack/react-query")) return "vendor-auth-query";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("\\react\\") || id.includes("\\react-dom\\")) {
            return "vendor-react";
          }
          return undefined;
        }
      }
    }
  }
});
