import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: projectRoot,
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        "**/character-packs/**/memory/**",
        "**/deleted-character-packs/**",
        "**/tmp/**",
      ],
    },
  },
  build: {
    rollupOptions: {
      input: "index.html",
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});
