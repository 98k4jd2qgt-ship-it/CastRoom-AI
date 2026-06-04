import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
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
