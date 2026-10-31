import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'Vaultory - Password & Secrets Manager',
        short_name: 'Vaultory',
        description: 'Encrypted personal vault for passwords, keys and secrets.',
        theme_color: '#0B0B12',
        background_color: '#0B0B12',
        display: 'standalone',
        scope: '/',
        start_url: '/dashboard',
        icons: [
          { src: '/logo.png', sizes: '1024x938', type: 'image/png', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // App-shell precache only. API responses are NEVER cached - the vault
        // holds ciphertext tied to a session cookie, and caching it would keep
        // encrypted rows on disk after logout.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/login/, /^\/signup/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Proxying keeps the API same-origin in development, so session cookies
    // work with SameSite=Lax exactly as they do behind a production rewrite.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@noble/hashes')) return 'crypto';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
